// 第一关 · 只有水
//
// 教规则 1(转相机改变连通)与规则 2(两端都得接上,水才过得去)。
//
// 兽在场,但不需要玩家操作:它开局就站在取水点上,水已经在流。规则 3 在这一关
// 是被「看见」的,不是被「要求」的 —— 玩家先看到兽站着水就流,第二关才轮到他
// 自己把兽送上去。walkLinks 全空,所以点画面任何地方都是转相机,一次就学会。
//
// 这一关没有「半满」的诱导角度:同一段渠的一端要在两个不同角度下都对上源池,
// 除非它和源池本来就是同一个点,否则自由度不够 —— 试过,做不到。
// 那个可见失败态留给第三关,规格本来也是那么安排的。

import type { Layout } from "../iso.ts";
import type { Level } from "../rules.ts";

export const level1: Level = {
  name: "只有水",

  pools: [
    { id: "sourcePool", isSource: true },
    { id: "finalPool", isFinal: true },
  ],

  channels: [{ id: "aqueduct", ends: ["sourcePool", "finalPool"] }],

  platforms: [
    // 视觉基座,不参与任何判定。
    { id: "ground" },
    // 兽站的那块台子,紧挨着源池。
    { id: "sourceLedge" },
  ],

  tapPoints: [{ id: "tap1", on: "sourceLedge" }],

  // 开局就站在取水点上 —— 水从第一帧就在流。
  beastAt: "tap1",

  cameraAngles: {
    // 开局。渠和两个池在画面上都错开,什么也不发生。
    45: { waterLinks: [], walkLinks: [] },

    135: { waterLinks: [], walkLinks: [] },

    // 解。两端同时对齐,渠灌满,终点池填满。
    225: {
      waterLinks: [
        ["sourcePool", "aqueduct"],
        ["aqueduct", "finalPool"],
      ],
      walkLinks: [],
    },

    315: { waterLinks: [], walkLinks: [] },
  },

  opensAt: 45,
};

/**
 * 每个 port 摆在哪。和上面的拓扑分开放,所以 `rules.ts` 完全不认识坐标。
 *
 * 坐标是照着等距投影的一条性质选的:y 升 1、x 和 z 各升 1,屏幕位置完全不变。
 * 所以 (-1,1,-1) 和 (0,0,0) 是同一个像素、差着一层楼 —— 水看着平平地流过去,
 * 其实爬上了塔。`spec/iso.test.ts` 会把每条声明的 link 投影一遍核对。
 *
 * 225° 下的对齐距离是 0.00,其余三个角度是 1.63。分得很开,不靠容差救。
 */
export const level1Layout: Layout = {
  ground: { at: [0, -0.6, 0] },
  sourcePool: { at: [0, 0, 0] },
  sourceLedge: { at: [1.4, 0, 1.4] },
  tap1: { at: [1.4, 0, 1.4] },
  aqueduct: { from: [-1, 1, -1], to: [-3, 1, -3] },
  finalPool: { at: [-4, 2, -4] },
};
