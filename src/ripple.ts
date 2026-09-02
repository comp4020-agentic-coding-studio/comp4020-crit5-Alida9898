// 点击反馈:荡漾开的一圈。
//
// 为什么不放进 Three.js 场景里:§3.5 写着「画面里没有关卡数据以外的几何」。
// 一圈涟漪不是关卡里的东西,它是对**一次点击**的回应,所以它属于覆盖层,
// 和走路把手一样 —— 位置也用同一个来源(相机的投影),不另算。
//
// 为什么不直接给按钮加动画:点下去之后 `placeHandles()` 会把整层把手换掉,
// 按钮当场消失,挂在它身上的动画一帧都放不完。涟漪必须活在不被换掉的那一层。

/**
 * 在覆盖层上放一圈涟漪,自己消失。
 *
 * `x`/`y` 是 0–1 的画面比例,和 `stage.toScreen()` 吐出来的是同一套数 ——
 * 不在这里做任何角度或像素换算(§3.3)。
 *
 * 收尾有两条路:动画正常放完走 `animationend`;而 `prefers-reduced-motion`
 * 下动画根本不播,`animationend` 永远不来,所以还有一个兜底的计时器。少了它,
 * 一个偏好减少动效的玩家点上二十下,就在 DOM 里留下二十个死元素。
 */
export function rippleAt(
  layer: HTMLElement,
  x: number,
  y: number,
  ms: number,
  miss = false,
): HTMLElement {
  const ring = layer.ownerDocument.createElement("span");
  // `miss` = 点到了、但这一下走不了。同一个形状,更暗更快 —— 「收到了」和
  // 「这一下有用」是两件事。两个完全一样的话,兽没动就分不出是没点到还是
  // 过不去,而那正是这个游戏要玩家读懂的东西(规则 1)。
  ring.className = miss ? "ripple miss" : "ripple";
  // 纯装饰,而且它说的事(「你点了这里」)屏幕阅读器已经从按钮上知道了。
  ring.setAttribute("aria-hidden", "true");
  ring.style.left = `${x * 100}%`;
  ring.style.top = `${y * 100}%`;
  ring.style.animationDuration = `${ms}ms`;

  const done = (): void => {
    clearTimeout(fallback);
    ring.remove();
  };
  const fallback = setTimeout(done, ms + 50);
  ring.addEventListener("animationend", done);

  layer.append(ring);
  return ring;
}
