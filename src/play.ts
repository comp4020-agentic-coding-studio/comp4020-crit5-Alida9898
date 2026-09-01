// 把规则接到页面上。
//
// 拾取是每块可转的砖一个 DOM 按钮,位置用**和相机同一个**投影算出来 ——
// 不是射线检测(架构约束禁止),而且覆盖层本身更好:canvas 对 axe 完全不透明,
// 而按钮是可聚焦、有名字的。

import { CAMERA } from "./config/style.ts";
import type { Layout } from "./iso.ts";
import { level1, level1Layout } from "./levels/level1.ts";
import type { Level, PartId, State } from "./rules.ts";
import {
  begin,
  canWalkTo,
  finalPoolFull,
  halfFilled,
  reachable,
  settle,
  turn,
} from "./rules.ts";
import type { Stage } from "./scene.ts";
import { createStage } from "./scene.ts";

const LEVELS: { level: Level; layout: Layout }[] = [{ level: level1, layout: level1Layout }];

type Elements = {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  handles: HTMLElement;
  progress: HTMLElement;
};

export function mount(el: Elements): () => void {
  let index = 0;
  let { level, layout } = LEVELS[0];
  let state: State = begin(level);
  let stage: Stage | null = null;
  let locked = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function paintWater(): void {
    stage?.setWater(state.filled, halfFilled(level, state), reachable(level, state));
  }

  /** 一次转动之后重新判定。**动画期间不判定** —— 中间状态必然穿帮。 */
  function resolve(): void {
    state = settle(level, state);
    paintWater();
    if (finalPoolFull(level, state)) {
      el.stage.classList.add("flowered");
    }
  }

  function act(part: PartId): void {
    if (locked) return;
    locked = true;
    state = turn(state, part);
    stage?.setTurns(state.config.turns);
    placeHandles();
    timer = setTimeout(() => {
      locked = false;
      resolve();
      placeHandles();
    }, CAMERA.turnMs);
  }

  function placeHandles(): void {
    const buttons: HTMLButtonElement[] = [];

    for (const part of level.parts) {
      // 把手落在这块砖当前的位置上,不是它静止时的位置。
      const anchor = level.channels.find((c) => layout.ports[c.id]?.part === part)?.id ?? part;
      const { x, y } = stage?.toScreen(anchor) ?? { x: 0.5, y: 0.5 };
      const b = document.createElement("button");
      b.type = "button";
      b.className = "handle";
      b.style.left = `${x * 100}%`;
      b.style.top = `${y * 100}%`;
      b.setAttribute("aria-label", `露台 ${part}`);
      b.addEventListener("click", () => act(part));
      buttons.push(b);
    }

    // 兽走得到的地方,也是可点的。第一关一个都没有。
    for (const platform of level.platforms) {
      if (!canWalkTo(level, state, platform.id)) continue;
      const { x, y } = stage?.toScreen(platform.id) ?? { x: 0.5, y: 0.5 };
      const b = document.createElement("button");
      b.type = "button";
      b.className = "handle walk";
      b.style.left = `${x * 100}%`;
      b.style.top = `${y * 100}%`;
      b.setAttribute("aria-label", `平台 ${platform.id}`);
      b.addEventListener("click", () => {
        if (locked) return;
        state = { ...state, beastAt: platform.id };
        stage?.setBeast(platform.id);
        resolve();
        placeHandles();
      });
      buttons.push(b);
    }

    el.handles.replaceChildren(...buttons);
  }

  function paintProgress(): void {
    el.progress.replaceChildren(
      ...LEVELS.map((_, i) => {
        const dot = document.createElement("li");
        dot.className = i < index ? "done" : i === index ? "here" : "";
        return dot;
      }),
    );
  }

  function load(next: number): void {
    if (timer !== undefined) clearTimeout(timer);
    locked = false;
    index = next;
    ({ level, layout } = LEVELS[next]);
    state = begin(level);
    el.stage.classList.remove("flowered");
    stage?.dispose();
    stage = createStage(el.canvas, level, layout);
    resize();
    resolve();
    placeHandles();
    paintProgress();
  }

  function resize(): void {
    const r = el.stage.getBoundingClientRect();
    stage?.resize(r.width, r.height);
    placeHandles();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(el.stage);

  let last = performance.now();
  let frame = requestAnimationFrame(function loop(now) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stage?.step(dt);
    stage?.render();
  });

  load(0);

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    cancelAnimationFrame(frame);
    observer.disconnect();
    stage?.dispose();
  };
}
