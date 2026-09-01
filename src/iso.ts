// 等距投影,以及每个 port 摆在哪里。
//
// 这个文件存在的理由只有两个:**画**,和**检查**。
// 它绝不参与连通判定 —— 那件事只查 `cameraAngles` 里手写的表。
//
// 但摆放位置和表格必须说的是同一件事,而这是可以自动检查的:把一条声明的
// link 的两端投影一下,看它们在屏幕上是不是真的落在一起。摆错了,测试就红。
// 「视觉对齐由模型摆放保证,由表格声明」—— 传感器盯的就是这两者之间。

import { CAMERA } from "./config/style.ts";
import type { Azimuth } from "./config/style.ts";
import type { PartId, PortId, Turn } from "./rules.ts";

export type Vec3 = [number, number, number];

/** 一个 port 在世界里的位置。渠是一段,所以有两端。
 *  `part` 说明它骑在哪块可转的砖上;不写就是钉死在塔上。 */
export type Placement =
  | { at: Vec3; part?: PartId }
  | { from: Vec3; to: Vec3; part?: PartId };

/** 一关里每个 port 摆在哪,以及每块砖绕哪根轴转。
 *  和拓扑分开放,`rules.ts` 因此完全不认识坐标。 */
export type Layout = {
  ports: Record<PortId, Placement>;
  pivots: Record<PartId, Vec3>;
};

/** 绕一根竖直轴转四分之一圈。 */
export function turnedAround(p: Vec3, pivot: Vec3, at: Turn): Vec3 {
  const dx = p[0] - pivot[0];
  const dz = p[2] - pivot[2];
  const angle = (-at * Math.PI) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [pivot[0] + dx * cos + dz * sin, p[1], pivot[2] - dx * sin + dz * cos];
}

const RAD = Math.PI / 180;

/**
 * 世界点 → 屏幕坐标,与相机完全一致。
 *
 * 屏幕 y 越大越靠上。规则 2「水只向看起来更低的方向流」说的就是 y 变小。
 */
export function project(p: Vec3, azimuthDeg: Azimuth): [number, number] {
  const az = azimuthDeg * RAD;
  const pitch = CAMERA.pitchDeg * RAD;
  const [x, y, z] = p;
  // right = (sin az, 0, -cos az);  up' = (-cos az·sinθ, cosθ, -sin az·sinθ)
  const sx = x * Math.sin(az) - z * Math.cos(az);
  const sy =
    -Math.sin(pitch) * (x * Math.cos(az) + z * Math.sin(az)) + y * Math.cos(pitch);
  return [sx, sy];
}

/** 正交视锥的四条边,单位和 `project()` 吐出来的一样。 */
export type Frustum = { left: number; right: number; top: number; bottom: number };

/**
 * 投影坐标 → 画面比例(0–1,y 向下)。覆盖层上每个按钮的位置都从这里出来。
 *
 * 它必须吃**当前的**视锥,不能假设视锥是正方形。这条是拿一次回归换来的:
 * 视锥改成按宽高比撑长边之后,`toScreen` 里还留着「除以那个正方形的 half」的
 * 手算,16:9 下横向差了 1.78 倍,整排按钮被推到画面外 —— 点不到、兽不走、
 * 连点击涟漪都不出现,而画面本身一切正常,所以看起来完全不像定位问题。
 *
 * §3.3 禁止在覆盖层定位里做角度运算,理由是同一类:凡是手抄一遍相机的东西,
 * 相机一变就悄悄过期。这个函数把「相机现在的视锥」变成参数,过期就没地方藏。
 */
export function frameFraction(
  sx: number,
  sy: number,
  f: Frustum,
): { x: number; y: number } {
  return {
    x: (sx - f.left) / (f.right - f.left),
    y: 1 - (sy - f.bottom) / (f.top - f.bottom),
  };
}

/** 相机站的位置方向(单位向量)。正交投影下距离无所谓,方向才重要。 */
export function eye(azimuthDeg: Azimuth): Vec3 {
  const az = azimuthDeg * RAD;
  const pitch = CAMERA.pitchDeg * RAD;
  return [
    Math.cos(pitch) * Math.cos(az),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(az),
  ];
}

/** 一个 port 用来判断对齐的点,已经把它所在砖块的转动算进去了。
 *  渠有两端,所以返回两个。 */
export function anchorsOf(
  place: Placement,
  layout?: Layout,
  turns?: Record<PartId, Turn>,
): Vec3[] {
  const raw: Vec3[] = "at" in place ? [place.at] : [place.from, place.to];
  const part = place.part;
  if (!part || !layout || !turns) return raw;
  const pivot = layout.pivots[part];
  if (!pivot) return raw;
  return raw.map((p) => turnedAround(p, pivot, turns[part] ?? 0));
}

/**
 * 两个 port 在这个角度下看起来是不是接在一起。
 *
 * **只在测试里用**。运行时永远不许调用它 —— 那就成了「用几何推导连通」,
 * 正是架构约束第一条禁止的事。这里它的用途是反过来的:表格已经声明了连通,
 * 这个函数检查摆放有没有跟上。
 */
export function looksJoined(
  a: Placement,
  b: Placement,
  azimuthDeg: Azimuth,
  layout?: Layout,
  turns?: Record<PartId, Turn>,
  tolerance = 0.35,
): boolean {
  for (const pa of anchorsOf(a, layout, turns)) {
    for (const pb of anchorsOf(b, layout, turns)) {
      const [ax, ay] = project(pa, azimuthDeg);
      const [bx, by] = project(pb, azimuthDeg);
      if (Math.hypot(ax - bx, ay - by) <= tolerance) return true;
    }
  }
  return false;
}
