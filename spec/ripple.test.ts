// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INPUT } from "../src/config/style.ts";
import { rippleAt } from "../src/ripple.ts";

// 一圈涟漪本身不需要传感器 —— 好不好看只有眼睛说了算。这里钉的是两件眼睛
// **看不出来**的事:它会不会把自己收干净,以及它会不会被读屏念出来。
//
// 收尾这条尤其:动画放完会自己走,所以正常玩一遍永远发现不了漏。只有在
// `prefers-reduced-motion` 下动画不播、`animationend` 不来,死元素才开始堆,
// 而那台机器不是作者的机器。

describe("点击涟漪", () => {
  let layer: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    layer = document.createElement("div");
    document.body.append(layer);
  });

  afterEach(() => {
    vi.useRealTimers();
    layer.remove();
  });

  it("落在传进来的那个画面比例上,不做别的换算", () => {
    const ring = rippleAt(layer, 0.25, 0.75, INPUT.rippleMs);
    expect(ring.style.left).toBe("25%");
    expect(ring.style.top).toBe("75%");
    expect(layer.children).toHaveLength(1);
  });

  it("读屏读不到它:它说的事按钮已经说过了", () => {
    const ring = rippleAt(layer, 0.5, 0.5, INPUT.rippleMs);
    expect(ring.getAttribute("aria-hidden")).toBe("true");
  });

  it("动画放完就把自己摘掉", () => {
    const ring = rippleAt(layer, 0.5, 0.5, INPUT.rippleMs);
    ring.dispatchEvent(new Event("animationend"));
    expect(layer.children).toHaveLength(0);
  });

  it("动画压根没播时也会消失 —— prefers-reduced-motion 下就是这样", () => {
    rippleAt(layer, 0.5, 0.5, INPUT.rippleMs);
    expect(layer.children).toHaveLength(1);
    vi.advanceTimersByTime(INPUT.rippleMs + 100);
    expect(layer.children).toHaveLength(0);
  });

  // 「收到了」和「这一下有用」是两件事。两种回执长得一样的话,兽没动就分不出
  // 是没点到还是这个角度过不去 —— 而后者正是规则 1,是这个游戏本身要玩家读懂
  // 的东西。类名是两者之间唯一的区别,所以钉在这里。
  it("走不到的那一下走 miss 那一档,走得到的不带它", () => {
    const hit = rippleAt(layer, 0.5, 0.5, INPUT.rippleMs);
    const miss = rippleAt(layer, 0.5, 0.5, INPUT.rippleMissMs, true);
    expect(hit.classList.contains("miss")).toBe(false);
    expect(miss.classList.contains("miss")).toBe(true);
    // 两个都还是涟漪 —— miss 是同一个记号的一档,不是另一个东西。
    expect(hit.classList.contains("ripple")).toBe(true);
    expect(miss.classList.contains("ripple")).toBe(true);
  });

  it("miss 那一档比正常的短 —— 它不该读成「兽要出发了」", () => {
    expect(INPUT.rippleMissMs).toBeLessThan(INPUT.rippleMs);
  });

  it("miss 那一圈也会自己收干净", () => {
    rippleAt(layer, 0.5, 0.5, INPUT.rippleMissMs, true);
    vi.advanceTimersByTime(INPUT.rippleMissMs + 100);
    expect(layer.children).toHaveLength(0);
  });

  it("连点几下是几圈,互不干扰", () => {
    for (let i = 0; i < 3; i++) rippleAt(layer, 0.5, 0.5, INPUT.rippleMs);
    expect(layer.children).toHaveLength(3);
    vi.advanceTimersByTime(INPUT.rippleMs + 100);
    expect(layer.children).toHaveLength(0);
  });
});
