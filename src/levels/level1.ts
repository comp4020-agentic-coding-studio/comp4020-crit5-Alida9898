// 第一关 · 只有水
//
// 教规则 1(转砖块改变连通)与规则 2(两端都得接上,水才过得去)。
//
// 兽在场,但不需要玩家操作:它开局就站在取水点上,水已经在流。规则 3 在这一关
// 是被「看见」的,不是被「要求」的 —— 玩家先看到兽站着水就流,第二关才轮到他
// 自己把兽送上去。walkLinks 全空,所以唯一能点的就是那块砖。

import type { Layout } from "../iso.ts";
import type { Level } from "../rules.ts";

export const level1: Level = {
  name: "只有水",

  pools: [
    { id: "sourcePool", isSource: true },
    { id: "finalPool", isFinal: true },
  ],

  channels: [{ id: "aqueduct", ends: ["sourcePool", "finalPool"] }],

  platforms: [{ id: "sourceLedge" }], // 兽站的台子

  tapPoints: [{ id: "tap1", on: "sourceLedge" }],

  parts: ["spur"],

  waterLinks: [
    // 渠的上游口只在这块砖转正时对上源池。这是这一关唯一的谜题。
    { between: ["sourcePool", "aqueduct"], when: { turns: { spur: 0 } } },
    // 下游口锚在轴心上,砖怎么转它都不动,所以永远对着终点池。
    { between: ["aqueduct", "finalPool"], when: {} },
  ],

  walkLinks: [],

  // 开局就站在取水点上 —— 水从第一帧就在流,只是流不过去。
  beastAt: "tap1",

  opens: { camera: 45, turns: { spur: 3 } },
};

/**
 * 每个 port 摆在哪。和上面的拓扑分开放,所以 `rules.ts` 完全不认识坐标。
 *
 * 坐标照着等距投影的一条性质选:在 45° 下,沿 (1,1,1) 走屏幕位置一动不动。
 * 所以 (1,1,1) 和 (0,0,0) 是同一个像素、差着一层楼;(4,2,4) 和 (3,1,3) 也是。
 * 水看着平平地流过去,其实爬了两层。`spec/iso.test.ts` 会把每条声明投影核对。
 */
export const level1Layout: Layout = {
  pivots: {
    // 渠的下游口就是轴心 —— 转动时它待在原地,只有上游口划过去。
    spur: [2, 1, 2],
  },
  ports: {
    sourcePool: { at: [0, 0, 0] },
    sourceLedge: { at: [1.6, 0, -0.6] },
    tap1: { at: [1.6, 0, -0.6] },
    // 上游口 (1,1,1) 与源池 (0,0,0) 差一个隐身方向 —— 同一个像素,差一层楼。
    // 下游口 (2,1,2) 与终点池 (3,2,3) 也是。水看着平平地流,其实爬了两层。
    aqueduct: { from: [1, 1, 1], to: [2, 1, 2], part: "spur" },
    finalPool: { at: [3, 2, 3] },
  },
};
