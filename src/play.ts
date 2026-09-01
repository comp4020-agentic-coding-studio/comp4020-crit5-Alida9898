// 把规则接到页面上。
//
// 拾取是每块可转的砖一个 DOM 按钮,位置用**和相机同一个**投影算出来 ——
// 不是射线检测(架构约束禁止),而且覆盖层本身更好:canvas 对 axe 完全不透明,
// 而按钮是可聚焦、有名字的。

import { CAMERA, INPUT } from "./config/style.ts";
import { turnFromDrag } from "./gesture.ts";
import { rippleAt } from "./ripple.ts";
import type { Layout } from "./iso.ts";
import { level1, level1Layout } from "./levels/level1.ts";
import type { Level, PartId, State } from "./rules.ts";
import {
  begin,
  canWalkTo,
  finalPoolFull,
  halfFilled,
  pour,
  reachable,
  standingOnPool,
  turn,
  turnCamera,
  walkableFrom,
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

  /** 只重画,不引水 —— 水只在按空格时流(规则 3)。 */
  function resolve(): void {
    paintWater();
    // 通关反馈:喷泉开始喷水。这是全部 —— §6 不许 HUD、不许胜利弹窗、
    // 不许进度条,所以「我赢了」只能由画面本身说。
    //
    // `.flowered` 这个类以前只是被切来切去,styles.css 里根本没有它,
    // scene.ts 也不认识 —— 也就是说通关一直是**完全不可见**的。现在真的
    // 接到场景上了。
    const solved = finalPoolFull(level, state);
    el.stage.classList.toggle("flowered", solved);
    stage?.setSolved(solved);
    el.stage.classList.toggle("attap", standingOnPool(level, state) !== null);
  }

  /**
   * 转相机。建筑一动不动,动的是看它的方向 —— 而「屏幕上看起来接着就是接着」,
   * 所以这一下会改变哪些东西连得上。
   *
   * 动画期间封锁输入,并且**把按钮全撤掉**:中间的每一个角度都在穿帮,
   * 那时候的拾取位置和连通判定都是没有意义的。
   */
  function swing(direction: 1 | -1): void {
    if (locked) return;
    locked = true;
    state = turnCamera(state, CAMERA.azimuthsDeg, direction);
    stage?.setCamera(state.config.camera);
    el.handles.replaceChildren();
    timer = setTimeout(() => {
      locked = false;
      resolve();
      placeHandles();
    }, CAMERA.turnMs);
  }

  /** 空格:从兽脚下的池子放水。不站在池子上就什么也不发生。 */
  function draw(): void {
    if (locked) return;
    if (standingOnPool(level, state) === null) return;
    state = pour(level, state);
    resolve();
    placeHandles();
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
      b.addEventListener("click", () => {
        // 涟漪挂在 stage 上,不挂在按钮上 —— 按钮下一帧就被 placeHandles()
        // 换掉了,挂在它身上的动画一帧都放不完。
        rippleAt(el.stage, x, y, INPUT.rippleMs);
        act(part);
      });
      buttons.push(b);
    }

    // 兽此刻走得到的每一处,都是可点的:地砖、泉眼,以及已经灌满的水渠。
    const here = state.beastAt;
    const reach = here ? walkableFrom(level, state, here) : new Set<string>();
    for (const port of reach) {
      if (port === here) continue;
      const { x, y } = stage?.toScreen(port) ?? { x: 0.5, y: 0.5 };
      const b = document.createElement("button");
      b.type = "button";
      const isPool = level.pools.some((p) => p.id === port);
      b.className = `handle walk${isPool ? " pool" : ""}`;
      b.title = "";
      b.style.left = `${x * 100}%`;
      b.style.top = `${y * 100}%`;
      b.setAttribute("aria-label", port);
      b.addEventListener("click", () => {
        if (locked) return;
        // 「我点的是这里」的回执。兽要走一段才到,不填这段空白,点击就像没被收到。
        rippleAt(el.stage, x, y, INPUT.rippleMs);
        state = { ...state, beastAt: port };
        stage?.setBeast(port);
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

  // 转视角是**拖**,点击只剩一个意思:让兽走过去。
  //
  // 上一版是「点物体 = 走路,点空处 = 转视角」。分开写的时候看着是分得开的,
  // 玩起来不是:两件事都是「按一下松开」,手上没有区别,第一次玩的人不知道自己
  // 刚才触发了哪一件,也就学不会哪一件由自己控制。拖和点在手上是两个动作,
  // 分得开 —— 这是把两个动词分给两个手势,不是把一个动词藏起来。
  //
  // 拖动**不跟手**:相机不会随手指连续转,只是够了阈值就播那一段固定的转场,
  // 落在下一个枚举档位上。§3.2 禁止自由环绕,理由是中间角度必然破坏错觉;
  // 那条禁令对手势和对方向键是同一条。
  let dragFrom: number | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    // 走路的把手是真按钮,点在上面的不算拖动的起手。
    if ((e.target as HTMLElement).closest("button")) return;
    dragFrom = e.clientX;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (dragFrom === null) return;
    // 方向那点算术在 gesture.ts 里,是纯函数;这里只负责把它接上。
    const step = turnFromDrag(e.clientX - dragFrom, INPUT.dragTurnPx);
    if (step === 0) return;
    // 一次拖动只落一档:一次手势 = 一段转场,和方向键按一下完全一样。
    dragFrom = null;
    swing(step);
  };

  const onPointerEnd = (): void => {
    dragFrom = null;
  };

  el.stage.addEventListener("pointerdown", onPointerDown);
  el.stage.addEventListener("pointermove", onPointerMove);
  el.stage.addEventListener("pointerup", onPointerEnd);
  el.stage.addEventListener("pointercancel", onPointerEnd);
  el.stage.addEventListener("pointerleave", onPointerEnd);

  const onKey = (e: KeyboardEvent): void => {
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      draw();
      return;
    }
    if (e.code === "ArrowLeft" || e.key === "ArrowLeft") {
      e.preventDefault();
      swing(-1);
      return;
    }
    if (e.code === "ArrowRight" || e.key === "ArrowRight") {
      e.preventDefault();
      swing(1);
    }
  };
  window.addEventListener("keydown", onKey);

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

  // 开发期的探针。留着是因为这一周有半小时耗在「画面和状态对不上」上,
  // 而真凶是浏览器缓存 —— 当时手里没有任何办法把「游戏认为的」和「画出来的」
  // 摆在一起看。生产构建里 import.meta.env.DEV 是 false,整段会被摇掉。
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__probe = () => ({
      camera: state.config.camera,
      filled: [...state.filled],
      beastAt: state.beastAt,
      screen: Object.fromEntries(
        Object.keys(layout.ports).map((id) => [id, stage?.toScreen(id)]),
      ),
    });
  }

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKey);
    el.stage.removeEventListener("pointerdown", onPointerDown);
    el.stage.removeEventListener("pointermove", onPointerMove);
    el.stage.removeEventListener("pointerup", onPointerEnd);
    el.stage.removeEventListener("pointercancel", onPointerEnd);
    el.stage.removeEventListener("pointerleave", onPointerEnd);
    observer.disconnect();
    stage?.dispose();
  };
}
