// 手势里那点带符号的算术,单独拎出来。
//
// CLAUDE.md 有一条是拿 C4 换来的:方向搞反的手势,在它平时待的那个地方是测不到的
// —— 它是 `pointermove` 处理器里的一行,要测就得先有 DOM、有合成 PointerEvent。
// 所以把带符号的部分放成纯函数,方向就只是 spec 里的两行。

/**
 * 一次横向拖动落在哪一档转向。
 *
 * 往右拖 = 和 → 键同一个方向,往左 = 和 ← 键同一个方向。没够阈值就是 0,不转 ——
 * 「不够」必须是一个明确的返回值,而不是让调用方去比大小,否则阈值这件事又散回
 * 处理器里去了。
 */
export function turnFromDrag(dx: number, threshold: number): 1 | 0 | -1 {
  if (!(threshold > 0)) return 0;
  if (dx >= threshold) return 1;
  if (dx <= -threshold) return -1;
  return 0;
}
