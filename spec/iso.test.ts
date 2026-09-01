import { describe, expect, it } from "vitest";
import { CAMERA } from "../src/config/style.ts";
import type { Layout } from "../src/iso.ts";
import { anchorsOf, project, turnedAround } from "../src/iso.ts";
import { level1, level1Layout } from "../src/levels/level1.ts";
import type { Config, Level, PartId, Turn } from "../src/rules.ts";
import { holds } from "../src/rules.ts";

// 摆放和表格必须说同一件事。
//
// 运行时永远不许从几何推导连通 —— 那是架构约束第一条。但反过来是允许的,而且
// 是必要的:表格已经声明「这两端在这个配置下看起来接着」,这里就把它们投影一遍,
// 看模型有没有真的摆成那样。挪一块砖,所有它参与的声明立刻变红。
//
// 没有这个,「视觉对齐由摆放保证」就只是一句话,靠人盯着截图,而人一改坐标就忘。

const CASES: { level: Level; layout: Layout }[] = [{ level: level1, layout: level1Layout }];

/** 枚举一关的全部配置。相机当前固定,所以只有砖块在变。 */
function configurations(level: Level): Config[] {
  let out: Config[] = [{ camera: level.opens.camera, turns: {} }];
  for (const part of level.parts) {
    const grown: Config[] = [];
    for (const base of out) {
      for (const at of [0, 1, 2, 3] as Turn[]) {
        grown.push({ ...base, turns: { ...base.turns, [part]: at } });
      }
    }
    out = grown;
  }
  return out;
}

function gap(
  layout: Layout,
  a: string,
  b: string,
  config: Config,
): number {
  let best = Infinity;
  for (const pa of anchorsOf(layout.ports[a], layout, config.turns)) {
    for (const pb of anchorsOf(layout.ports[b], layout, config.turns)) {
      const [ax, ay] = project(pa, config.camera);
      const [bx, by] = project(pb, config.camera);
      best = Math.min(best, Math.hypot(ax - bx, ay - by));
    }
  }
  return best;
}

describe("等距投影本身", () => {
  // 每个相机角度都有一个「隐身方向」:沿它走,屏幕位置一动不动 ——
  // 因为它正是那个角度下的视线方向。四个角度的隐身方向各不相同,
  // 这就是四个角度能造出四种不同错觉的根本原因,不是巧合。
  const HIDDEN: Record<number, [number, number, number]> = {
    45: [1, 1, 1],
    135: [-1, 1, 1],
    225: [-1, 1, -1],
    315: [1, 1, -1],
  };

  it("沿该角度的隐身方向走,落在同一个像素上", () => {
    for (const az of CAMERA.azimuthsDeg) {
      const a = project([0, 0, 0], az);
      const b = project(HIDDEN[az], az);
      expect(a[0], `${az}° 的隐身方向不隐身`).toBeCloseTo(b[0], 6);
      expect(a[1], `${az}° 的隐身方向不隐身`).toBeCloseTo(b[1], 6);
    }
  });

  it("四个角度的隐身方向互不相同", () => {
    const seen = new Set(CAMERA.azimuthsDeg.map((az) => HIDDEN[az].join(",")));
    expect(seen.size).toBe(CAMERA.azimuthsDeg.length);
  });

  it("单纯远离相机,就是往画面下方走", () => {
    const RAD = Math.PI / 180;
    for (const az of CAMERA.azimuthsDeg) {
      const away: [number, number, number] = [Math.cos(az * RAD), 0, Math.sin(az * RAD)];
      expect(project(away, az)[1]).toBeLessThan(project([0, 0, 0], az)[1] - 1e-9);
    }
  });

  it("转四次回到原处", () => {
    const p: [number, number, number] = [1, 1, 1];
    const pivot: [number, number, number] = [3, 1, 3];
    let at = p;
    for (let i = 0; i < 4; i++) at = turnedAround(at, pivot, 1);
    expect(at[0]).toBeCloseTo(p[0], 6);
    expect(at[2]).toBeCloseTo(p[2], 6);
  });
});

describe("每条声明的 link,模型都真的摆成了那样", () => {
  for (const { level, layout } of CASES) {
    describe(level.name, () => {
      it("给每个 port 都摆了位置", () => {
        const ports = [
          ...level.pools.map((p) => p.id),
          ...level.channels.map((c) => c.id),
          ...level.platforms.map((p) => p.id),
          ...level.tapPoints.map((t) => t.id),
        ];
        for (const id of ports) expect(layout.ports[id], `${id} 没有摆放位置`).toBeTruthy();
      });

      it("给每块可转的砖都定了轴心", () => {
        for (const part of level.parts) {
          expect(layout.pivots[part], `${part} 没有轴心`).toBeTruthy();
        }
      });

      it("声明看起来接着的,投影后确实接在一起", () => {
        for (const config of configurations(level)) {
          // 水路和步行路要求的是**同一段几何上的两个不同判定**,规格特意点明了
          // 这一点。渠口接池子必须像素级重合,否则水就是凭空跳过去的;而两块
          // 相邻的地砖只要挨着,兽迈一步就过去了。用同一个阈值卡两者,要么把
          // 正常的路判成错,要么把没对上的渠放过去。
          for (const f of level.waterLinks) {
            if (!holds(f.when, config)) continue;
            const d = gap(layout, f.from, f.to, config);
            expect(
              d,
              `${level.name}: 声明水从 ${f.from} 流到 ${f.to},但两端差 ${d.toFixed(2)}`,
            ).toBeLessThan(0.05);
          }
          for (const l of level.walkLinks) {
            if (!holds(l.when, config)) continue;
            const [a, b] = l.between;
            const d = gap(layout, a, b, config);
            expect(
              d,
              `${level.name}: 声明可以从 ${a} 走到 ${b},但它们在画面上差 ${d.toFixed(2)},` +
                `隔得太远,读不出是相邻的`,
            ).toBeLessThan(1.0);
          }
        }
      });

      it("没声明的配置下,那两端确实是分开的", () => {
        // 反过来也得对:如果一条 link 在别的档位下其实也对得上,玩家就会看到
        // 「明明接上了却不流」,而那不是这一关想教的东西 —— 是 bug。
        for (const config of configurations(level)) {
          for (const link of level.waterLinks) {
            if (holds(link.when, config)) continue;
            const [a, b] = [link.from, link.to];
            const d = gap(layout, a, b, config);
            expect(
              d,
              `${level.name}: ${a}–${b} 在 ${JSON.stringify(config.turns)} 下没声明,` +
                `但看起来只差 ${d.toFixed(2)},玩家会以为该通`,
            ).toBeGreaterThan(0.6);
          }
        }
      });

      it("水路从源出发,一路都在往画面下方走", () => {
        // 规则 2。表格是无向的,方向由「从源开始漫」决定,所以跟着漫一遍,
        // 确认每一步都没有把水往上送。
        for (const config of configurations(level)) {
          const screenY = (id: string): number[] =>
            anchorsOf(layout.ports[id], layout, config.turns).map(
              (p) => project(p, config.camera)[1],
            );
          // 有向表,所以直接逐条核对:声明的 to 必须真的在画面上更低。
          // 作者写方向,传感器盯着他有没有写反。
          for (const flow of level.waterLinks) {
            if (!holds(flow.when, config)) continue;
            expect(
              Math.min(...screenY(flow.to)),
              `${level.name}: 声明水从 ${flow.from} 流到 ${flow.to},但 ${flow.to} 在画面上更高`,
            ).toBeLessThanOrEqual(Math.max(...screenY(flow.from)) + 1e-6);
          }
        }
      });

      it("开局那个配置下水到不了终点", () => {
        const opening: Config = level.opens;
        const live = level.waterLinks.filter((l) => holds(l.when, opening));
        expect(live.length, `${level.name} 开局就全通了`).toBeLessThan(
          level.waterLinks.length,
        );
      });
    });
  }
});
