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
import type { PortId } from "./rules.ts";

export type Vec3 = [number, number, number];

/** 一个 port 在世界里的位置。渠是一段,所以有两端。 */
export type Placement = { at: Vec3 } | { from: Vec3; to: Vec3 };

/** 一关里每个 port 摆在哪。和拓扑分开放,`rules.ts` 因此完全不认识坐标。 */
export type Layout = Record<PortId, Placement>;

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

/** 一个 port 用来判断对齐的那个点。渠取两端各算一次,见 `endsOf`。 */
export function anchorsOf(place: Placement): Vec3[] {
  return "at" in place ? [place.at] : [place.from, place.to];
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
  tolerance = 0.35,
): boolean {
  for (const pa of anchorsOf(a)) {
    for (const pb of anchorsOf(b)) {
      const [ax, ay] = project(pa, azimuthDeg);
      const [bx, by] = project(pb, azimuthDeg);
      if (Math.hypot(ax - bx, ay - by) <= tolerance) return true;
    }
  }
  return false;
}
