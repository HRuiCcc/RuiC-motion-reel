# 3D：点云渲染

`engine/three.py`。不是三角形光栅化器，也不打算是。

## 为什么不用三角形

Python 里逐三角形循环太慢，而"用 numpy 批量处理"的路子在三角光栅化上很难做对（三角形大小不一、
边界要插值重心坐标）。**点云方案把问题换成了它擅长的形状**：
曲面密采样 → 投影 → **按深度排序后散射**（远的先写、近的后写）。
numpy 对重复下标保留**最后一次**写入，这正好是画家算法，遮挡是精确的。
而且密集点云自带轻微颗粒感，印出来/拍出来都好看——这也是铜版雕刻（stipple engraving）的原理。

代价：**分辨率靠采样密度堆**。掠射角（面几乎侧对镜头）处点会稀，见「坑」。

## 基本流程

```python
from mg import three as TH

P, N, shape = TH.sample(TH.knot_tube(tube=0.25, p=3, q=4), nu=1000, nv=260)
P, N = TH.rot_x(P, -0.26), TH.rot_x(N, -0.26)      # 旋转也要作用到法线
P, N = TH.rot_z(P, spin), TH.rot_z(N, spin)

cam = TH.Camera(eye=(0, 0.72, 7.1), target=(0,0,0), fov=30, w=W, h=H, shift=(0, 26))
cov, lum, depth = TH.render(cam, P, N, splat=2, soften=1,
                            ambient=0.14, key_gain=1.18, rim_gain=0.60)
# cov  覆盖率 0/1（已抗锯齿）
# lum  明暗 0~1.2
# depth 归一化深度（可用于 fog、可用作隐藏线判定）
```

### `sample()` 的关键：法线来自偏导数
`fn(u,v)` 要写成**参数曲面**，法线用中心差分 `cross(∂P/∂u, ∂P/∂v)` 求。
不需要网格拓扑、不需要顶点法线插值，天然光滑。

微小量 `_E = 8e-4` 别改大：太大法线会糊，太小会被浮点噪声放大。

### 相机
`Camera(eye, target, up, fov, w, h, shift)`。`shift` 是**画面内的平移偏移**，
用来把物体挪到构图位置而不动镜头朝向——比调 target 直观。

**尺寸感受**：物体统一归一化到半径 1.0（`fit_radius`），
那么投影半径 ≈ `1.0 / eye_z * (h/2 / tan(fov/2))`。
h=720、fov=30 时 `f≈1343`，所以 z=4.5 → 半径约 300px；
排版空间若是 1080p（h=1080），同一个 fov 下 `f≈2015`，z=4.5 → 半径约 448px。
按这个先算再调，别试错。

### 光照
相机空间的三件套：**key + ambient + rim**。key 定义在**相机空间**（光源跟着镜头走），
所以同一个物体的打光在任何机位都成立。

```python
KEY = norm(np.array([-0.46, 0.58, -0.67]))   # 左上、朝镜头
lam = clip(n · KEY, 0, None)
rim = (1 - |n.z|) ** 2.3                     # 边缘掠射 = 曲面感的最大来源
lum = ambient + key_gain*lam + rim_gain*rim
```
`rim` 是把"平的剪影"变成"有体积"的那一项，权重别省。

## 生成器

| 函数 | 形状 | 用途 |
|---|---|---|
| `mobius(width)` | 单侧曲面 | "只有一面"的隐喻，印刷主题 |
| `knot_tube(tube,p,q)` | (p,q) 环面结扫掠管 | 遮挡关系明确的雕塑，最上镜 |
| `supershape(...)` | Gielis 超形 | 有机尖刺体（尖刺会自交，见坑） |
| `sweep_ellipse(curve, half_w, half_t, twist)` | 扁椭圆扫掠 | **有厚度的缎带**，数据可视化 |
| `box_surface(centre, size, nu, nv, front_bias)` | 长方体点云 | 机箱/堆叠结构 |
| `band(curve, width_fn, twist)` | 零厚度带 | 已不推荐，会被 sweep_ellipse 替代 |

## 配方

### 服务器机柜（`box_surface` + 面内细节）
堆 N 个机箱 + 两根导轨。**前面板的细节不要用贴图**：把面板四角做同样的旋转投影，
得到投影后的四边形，再在**那个平面里**画通风栅、硬盘位、状态灯。
这样透视是正确的，而且细节会随旋转动。

```python
def proj(pts):
    q = TH.rot_y(TH.rot_x(np.asarray(pts, np.float32), tilt), ang)
    r = cam.project(q)
    return [(float(p[0]), float(p[1])) if p[2] > 0 else None for p in r]
```

### 数据缎带（`sweep_ellipse` + 真实数据）
宽度函数直接吃音频包络，长度方向的扭转让它在 3D 里读得出来。
再叠**隐藏线线刻**当主版：

```python
vis = TH.visible_grid(cam, Pgrid, depth, tol=0.012)   # 逐点可见性
runs = TH.contour_grid(cam, Pgrid, vis)               # 可见段折线
```
`contour_grid` 返回的是**一段段可见折线**，远的半边自动被挡住——
这就是"刻版"效果，不要用整条线。

### 分色套准（印刷主题）
同一个 3D 渲染，把四块版**各自按不同方向平移**后叠印，再做"拉开→套准"的编排。
运动编排用 `anim.ease_path`：hold → 拉开 → hold → 突然归位（带 3~7px 过冲抖动）。

## 性能

| 点数 | render 耗时 | 说明 |
|---|---|---|
| 18 万 | ~50 ms | 封面/花饰够用 |
| 26 万 | ~90 ms | 主角镜头 |
| 100 万+ | ~0.4 s | 只在极特写用 |

一帧的预算里，3D 渲染通常**不是**瓶颈，后面的 bloom/网点才是。
几何采样结果要**缓存**（`print.geometry(key, build)`），只有旋转是每帧算的。
