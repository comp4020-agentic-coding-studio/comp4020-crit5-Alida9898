import { describe, expect, it } from "vitest";
import { INPUT } from "../src/config/style.ts";
import { turnFromDrag } from "../src/gesture.ts";

// 这个文件只为一件事存在:**方向**。
//
// C4 的倒水手势把水送反了 —— 两个方向都动得很顺,都不报错,整套测试全程绿,
// 最后是一个人拖着杯子说「怎么反了」才发现的。那一行加号待在 `pointermove` 里,
// 单元测试够不着。所以这里的规矩是:凡是带符号的手势算术,先有纯函数,再有处理器。

describe("拖动转视角的方向", () => {
  it("往右拖,和 → 键同一个方向", () => {
    expect(turnFromDrag(INPUT.dragTurnPx, INPUT.dragTurnPx)).toBe(1);
    expect(turnFromDrag(INPUT.dragTurnPx * 3, INPUT.dragTurnPx)).toBe(1);
  });

  it("往左拖,和 ← 键同一个方向", () => {
    expect(turnFromDrag(-INPUT.dragTurnPx, INPUT.dragTurnPx)).toBe(-1);
    expect(turnFromDrag(-INPUT.dragTurnPx * 3, INPUT.dragTurnPx)).toBe(-1);
  });

  it("没够阈值就不转 —— 点一下就是点一下,不是一次极短的拖动", () => {
    expect(turnFromDrag(0, INPUT.dragTurnPx)).toBe(0);
    expect(turnFromDrag(INPUT.dragTurnPx - 1, INPUT.dragTurnPx)).toBe(0);
    expect(turnFromDrag(-(INPUT.dragTurnPx - 1), INPUT.dragTurnPx)).toBe(0);
  });

  it("阈值非正时一律不转,不至于把一次点击读成一串旋转", () => {
    expect(turnFromDrag(500, 0)).toBe(0);
    expect(turnFromDrag(-500, -10)).toBe(0);
  });
});
