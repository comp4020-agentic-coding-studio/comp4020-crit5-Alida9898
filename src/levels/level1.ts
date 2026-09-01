// 第一关 · 引水造桥,再转个方向看
//
// 流程:出生点 →(通的砖路)→ 泉眼 → 空格引水 → 渠灌满成桥 → 踩水过桥 →
// 前方的阶梯渠够不到大池 → 转视角,它接上了 → 再引水,填满终点大池。
//
// 教学意图:前半段只教「饮水造桥」,最后才第一次出现「转视角」。两件事各教
// 一次,都简单到不算谜题。可转的砖块留给第二关。
//
// 空渠 span 横跨断口,两头都接着地面 —— 玩家在没水的时候就该看出「这是一条
// 潜在的路,只是现在是空的」。那个视觉暗示替代文字教程。

import type { Layout } from "../iso.ts";
import type { Level } from "../rules.ts";

export const level1: Level = {
  name: "引水造桥",

  pools: [
    { id: "springA" },
    { id: "springB" },
    // 终点大池:更大、更精致,一眼认得出。
    { id: "grandBasin", isFinal: true, grand: true },
  ],

  channels: [
    // 第一道渠:两头分别锚在两个泉眼上,所以引水就能灌满 —— 这是「造桥」。
    { id: "span", ends: ["springA", "springB"] },
    // 第二道渠骑在可转的砖上,转正之前它的下游端谁也接不到。
    { id: "spout", ends: ["springB", "grandBasin"] },
  ],

  platforms: [{ id: "birth" }, { id: "walkway" }],

  // 不再需要:任何池子都能当水源,看兽站在哪一个上面。
  tapPoints: [],

  // 第一关没有可转的砖块 —— 这一关的第二个动词是转视角。
  parts: [],

  // 有向。水只往画面下方走,方向写在数据里而不是运行时算出来。
  waterLinks: [
    { from: "springA", to: "span", when: {} },
    { from: "span", to: "springB", when: {} },
    { from: "springB", to: "spout", when: {} },
    // 阶梯渠的下游口只在 135° 那个方向上落到大池边沿。其余三个角度它悬在
    // 空中 —— 从 springB 引水,水会流进去然后停住,末端悬空。那是允许发生的
    // 可见状态,不是 bug。
    { from: "spout", to: "grandBasin", when: { camera: 135 } },
  ],

  // 无向。提到渠的那两条,只有该渠灌满之后才生效(规则 5)。
  walkLinks: [
    { between: ["birth", "walkway"], when: {} },
    { between: ["walkway", "springA"], when: {} },
    { between: ["springA", "span"], when: {} },
    { between: ["span", "springB"], when: {} },
    { between: ["springB", "spout"], when: {} },
    { between: ["spout", "grandBasin"], when: { camera: 135 } },
  ],

  beastAt: "birth",

  opens: { camera: 45, turns: {} },
};

/**
 * 摆放。逻辑锚点是每个 port 的中心;渲染时水渠会两头各缩短一点,好让它读成
 * 「从池边到池边」而不是插进池心。
 *
 * spout 的下游口 (2,0,8) 与大池 (3,1,9) 差一个隐身方向 —— 屏幕上同一点、
 * 空间里高一层。转正的那一下,水就爬上去了。
 */
export const level1Layout: Layout = {
  pivots: {},
  ports: {
    // 相邻的地砖间距 1 —— 也就是一块砖的宽度,紧挨着,兽一步迈过去。
    birth: { at: [0, 0, 0] },
    walkway: { at: [1, 0, 0] },
    springA: { at: [1, 0, 1] },
    // 断口在 z=2:那里什么也没有,空渠横跨过去。
    span: { from: [1, 0, 1], to: [1, 0, 3] },
    springB: { at: [1, 0, 3] },
    spout: { from: [1, 0, 3], to: [1, 0, 4] },
    // 大池与阶梯渠的下游口差一个 (-1, 1, 1) —— 那是 **135°** 的隐身方向。
    // 每个相机角度的隐身方向都不同(45° 是 (1,1,1)),所以这一个差值只在
    // 135° 让两者落到同一像素,另外三个角度差 1.63,明明白白断开。
    grandBasin: { at: [0, 1, 5] },
  },
};
