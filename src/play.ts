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
import { level2, level2Layout } from "./levels/level2.ts";
import type { Level, PartId, State } from "./rules.ts";
import {
  begin,
  canWalkTo,
  finalPoolFull,
  halfFilled,
  pour,
  reachable,
  wetPools,
  standingOnPool,
  turn,
  turnCamera,
  walkableFrom,
} from "./rules.ts";
import type { Stage } from "./scene.ts";
import { createStage } from "./scene.ts";

const LEVELS: { level: Level; layout: Layout }[] = [
  { level: level1, layout: level1Layout },
  { level: level2, layout: level2Layout },
];

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
  let advance: ReturnType<typeof setTimeout> | undefined;

  function paintWater(): void {
    // 第三个参数是「哪些池子有水」,用的是 `wetPools` 不是 `reachable` ——
    // 后者从兽此刻站着的池子实时漫出去,兽一走开水就消失,而规则 3、4 都写着
    // 已经发生的不回退。
    stage?.setWater(state.filled, halfFilled(level, state), wetPools(level, state));
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
    // 通关之后自己进下一关 —— §7 不做菜单、不做关卡选择,所以「下一关」不能是
    // 一个按钮。先让喷泉喷一会儿:那是唯一的通关反馈,不给它时间等于没给反馈。
    if (solved && index + 1 < LEVELS.length && advance === undefined) {
      advance = setTimeout(() => {
        advance = undefined;
        load(index + 1);
      }, INPUT.nextLevelMs);
    }
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
    //
    // 可点区域是**那件东西看得见的整个形状**,不是它顶面那个小菱形。
    //
    // 第一版只取顶面一格的四个角。露台后来变成整层高的塔,顶面就只是塔上一个
    // 小菱形 —— 点在塔身上落空,而且塔越高落空的面积越大,读起来就是「有时候
    // 点不到」。现在取那件几何包围盒的八个角、投影、求凸包,再用 clip-path 裁
    // 出轮廓;clip-path 同时裁**命中区域**,所以外接矩形叠得再多也不会抢别人的
    // 点击。没有射线检测:「哪里可点」和「哪里画得出来」是同一次投影的两个出口。
    const here = state.beastAt;
    const reach = here ? walkableFrom(level, state, here) : new Set<string>();
    // 轮廓会互相重叠,所以按离相机的远近排:近的后进 DOM,压在上面。
    // 不排的话,点在近处那座塔上,命中的可能是被它挡住的那一块。
    const targets = [...reach]
      .filter((p) => p !== here)
      .sort((a, b) => (stage?.depthOf(a) ?? 0) - (stage?.depthOf(b) ?? 0));
    for (const port of targets) {
      const quad: { x: number; y: number }[] = stage?.toScreenHull(port) ?? [];
      const b = document.createElement("button");
      b.type = "button";
      const isPool = level.pools.some((p) => p.id === port);
      b.className = `handle walk area${isPool ? " pool" : ""}`;
      b.setAttribute("aria-label", port);

      if (quad.length >= 3) {
        const xs = quad.map((p: { x: number; y: number }) => p.x);
        const ys = quad.map((p: { x: number; y: number }) => p.y);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        const w = x1 - x0;
        const h = y1 - y0;
        b.style.left = `${x0 * 100}%`;
        b.style.top = `${y0 * 100}%`;
        b.style.width = `${w * 100}%`;
        b.style.height = `${h * 100}%`;
        // clip-path 的百分比是相对按钮自己的框,所以四个角要换算进去。
        b.style.clipPath = `polygon(${quad
          .map(
            (p: { x: number; y: number }) =>
              `${((p.x - x0) / w) * 100}% ${((p.y - y0) / h) * 100}%`,
          )
          .join(", ")})`;
      } else {
        // 拿不到轮廓就退回中心那个小圆点 —— 宁可小,不要没有。
        const { x, y } = stage?.toScreen(port) ?? { x: 0.5, y: 0.5 };
        b.classList.remove("area");
        b.style.left = `${x * 100}%`;
        b.style.top = `${y * 100}%`;
      }

      b.addEventListener("click", (e) => {
        if (locked) return;
        // 涟漪落在**手指真正点到的那一点**上,不是砖的中心 —— 「我点的是这里」
        // 说的就是这里。键盘触发的 click 没有坐标(detail === 0),那时才退回
        // 砖的中心。
        const box = el.stage.getBoundingClientRect();
        const spot =
          e.detail === 0
            ? (stage?.toScreen(port) ?? { x: 0.5, y: 0.5 })
            : { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
        rippleAt(el.stage, spot.x, spot.y, INPUT.rippleMs);
        state = { ...state, beastAt: port };
        stage?.setBeast(port);
        resolve();
        placeHandles();
      });
      buttons.push(b);
    }

    el.handles.replaceChildren(...buttons);
  }

  /**
   * 底下那排点:既是进度,也是选关。
   *
   * §7 的「本版不做」里列着 menus 和 level select;2026-09-02 作者要选关,
   * 记在 §7 里。做法是**把已有的进度点变成可点的**,不是另开一个菜单页 ——
   * 屏幕上不多一个元素,只是本来就在那儿的点现在能按。没有文字、没有标题画面,
   * §7 其余的限制一条没动。
   */
  function paintProgress(): void {
    el.progress.replaceChildren(
      ...LEVELS.map((entry, i) => {
        const dot = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = i < index ? "done" : i === index ? "here" : "";
        // 读屏要念得出这是第几关、叫什么 —— canvas 对 axe 完全不透明,
        // 这排按钮是整个页面上唯一说得出「有几关」的东西。
        b.setAttribute("aria-label", `第 ${i + 1} 关:${entry.level.name}`);
        if (i === index) b.setAttribute("aria-current", "true");
        b.addEventListener("click", () => {
          if (i !== index) load(i);
        });
        dot.append(b);
        return dot;
      }),
    );
  }

  function load(next: number): void {
    if (timer !== undefined) clearTimeout(timer);
    if (advance !== undefined) {
      clearTimeout(advance);
      advance = undefined;
    }
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
    if (advance !== undefined) clearTimeout(advance);
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
