// 第一关 · 转一下,渠就接上了
//
// 只教三件事:**转相机**、**引水**、**走过去**。别的一概不做。
//
// 流程:
//   1. 兽从出生点走到泉眼               —— 走
//   2. 按空格引水,水流进渠里,停住      —— 引水,并且看见渠断了一截
//   3. 转相机,断开的那截接上了大池      —— 转相机
//   4. 再按空格,渠灌满,大池填满,过关
//
// 第 2 步那个「水停在渠里、末端悬空」不是 bug,是规格要求的可见状态。玩家在
// 那一刻会自己去找办法,而画面上唯一还没试过的东西就是方向键。

import type { Layout } from "../iso.ts";
import type { Level } from "../rules.ts";

export const level1: Level = {
  name: "转一下,渠就接上了",

  pools: [
    { id: "spring" },
    { id: "grandBasin", isFinal: true, grand: true },
  ],

  // 一条渠,一个断口。这一关只有它。
  channels: [{ id: "aqueduct", ends: ["spring", "grandBasin"] }],

  platforms: [{ id: "birth" }, { id: "walkway" }],

  tapPoints: [],
  parts: [],

  waterLinks: [
    // 上游口一直坐在泉眼上,任何角度都接着。
    { from: "spring", to: "aqueduct", when: {} },
    // 下游口只在 135° 落到大池边沿。另外三个角度它悬在空中 ——
    // 水流进去就停住,末端悬空。
    { from: "aqueduct", to: "grandBasin", when: { camera: 135 } },
  ],

  walkLinks: [
    { between: ["birth", "walkway"], when: {} },
    { between: ["walkway", "spring"], when: {} },
    // 灌满之后,渠面就是路,兽可以踩着走到大池 —— 但仍然要那个角度看得通。
    { between: ["spring", "aqueduct"], when: { camera: 135 } },
    { between: ["aqueduct", "grandBasin"], when: { camera: 135 } },
  ],

  beastAt: "birth",

  opens: { camera: 45, turns: {} },
};

/**
 * 摆放。
 *
 * 渠的下游口 (1,0,4) 与大池 (0,1,5) 差一个 (-1,1,1) —— 那是 **135°** 的隐身
 * 方向。每个相机角度的隐身方向都不一样(45° 是 (1,1,1)),所以这一个差值只在
 * 135° 让两者落到同一像素;另外三个角度差 1.63,断得清清楚楚。
 */
export const level1Layout: Layout = {
  pivots: {},
  ports: {
    birth: { at: [1, 0, 0] },
    walkway: { at: [1, 0, 1] },
    spring: { at: [1, 0, 2] },
    aqueduct: { from: [1, 0, 2], to: [1, 0, 4] },
    grandBasin: { at: [0, 1, 5] },
  },
};
