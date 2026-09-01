// 第一关 · 只有水
//
// 教规则 1(转相机改变连通)与规则 2(两端都得接上,水才过得去)。
// 兽不参与:tapPoints 为空,所以水从第一帧就在流,玩家唯一能做的事是转相机。
//
// 四个角度里有一个是「诱导」:135° 下渠看起来接上了源池,但另一端悬空,
// 水会流进渠里停住。那不是 bug,是规则 4 的可见形态,第三关会正式用到它。

import type { Level } from "../rules.ts";

export const level1: Level = {
  name: "只有水",

  pools: [
    { id: "sourcePool", isSource: true },
    { id: "finalPool", isFinal: true },
  ],

  channels: [{ id: "aqueduct", ends: ["sourcePool", "finalPool"] }],

  // 视觉基座,不参与任何判定 —— 不出现在下面任何一条 link 里。
  platforms: [{ id: "ground" }],

  // 空:兽不参与这一关。rules.ts 里 tapPoints 为空即视为水常流。
  tapPoints: [],

  cameraAngles: {
    // 开局。渠和两个池在画面上都错开,什么也不发生。
    45: { waterLinks: [], walkLinks: [] },

    // 诱导角度。渠的上游端对上了源池,下游端悬在空中 ——
    // 水流进去,停在渠中,末端悬空。
    135: { waterLinks: [["sourcePool", "aqueduct"]], walkLinks: [] },

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
