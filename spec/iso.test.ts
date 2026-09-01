import { describe, expect, it } from "vitest";
import { CAMERA } from "../src/config/style.ts";
import type { Azimuth } from "../src/config/style.ts";
import type { Layout } from "../src/iso.ts";
import { anchorsOf, looksJoined, project } from "../src/iso.ts";
import { level1, level1Layout } from "../src/levels/level1.ts";
import type { Level } from "../src/rules.ts";

// 摆放和表格必须说同一件事。
//
// 运行时永远不许从几何推导连通 —— 那是架构约束第一条。但反过来是允许的,而且
// 是必要的:表格已经声明「这两端在这个角度下看起来接着」,这里就把它们投影一遍,
// 看模型有没有真的摆成那样。挪动一块露台,所有它参与的声明立刻变红。
//
// 没有这个,「视觉对齐由摆放保证」就只是一句话,靠人盯着截图,而人一改坐标就忘。

const CASES: { level: Level; layout: Layout }[] = [{ level: level1, layout: level1Layout }];

describe("等距投影本身", () => {
  // 每个相机角度都有一个「隐身方向」:沿它走,屏幕位置一动不动 ——
  // 因为它正是那个角度下的视线方向。四个角度的隐身方向各不相同,
  // **这就是四个角度能造出四种不同错觉的根本原因**,不是巧合。
  const HIDDEN: Record<number, [number, number, number]> = {
    45: [1, 1, 1],
    135: [-1, 1, 1],
    225: [-1, 1, -1],
    315: [1, 1, -1],
  };

  it("沿该角度的隐身方向走,落在同一个像素上", () => {
    // 整个错觉压在这一条上:升一层楼、同时退一格,画面上没动过。
    for (const az of CAMERA.azimuthsDeg) {
      const a = project([0, 0, 0], az);
      const b = project(HIDDEN[az], az);
      expect(a[0], `${az}° 的隐身方向不隐身`).toBeCloseTo(b[0], 6);
      expect(a[1], `${az}° 的隐身方向不隐身`).toBeCloseTo(b[1], 6);
    }
  });

  it("四个角度的隐身方向互不相同", () => {
    // 如果两个角度共用一条隐身方向,它们能造的错觉就是同一种,
    // 那个角度就白给了。
    const seen = new Set(CAMERA.azimuthsDeg.map((az) => HIDDEN[az].join(",")));
    expect(seen.size).toBe(CAMERA.azimuthsDeg.length);
  });

  it("单纯远离相机,就是往画面下方走", () => {
    // 错觉要读得出来,前提是「远离相机 = 画面上更低」这条直觉先成立。
    const RAD = Math.PI / 180;
    for (const az of CAMERA.azimuthsDeg) {
      const away: [number, number, number] = [Math.cos(az * RAD), 0, Math.sin(az * RAD)];
      expect(project(away, az)[1]).toBeLessThan(project([0, 0, 0], az)[1] - 1e-9);
    }
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
        for (const id of ports) expect(layout[id], `${id} 没有摆放位置`).toBeTruthy();
      });

      it("声明看起来接着的,投影后确实接着", () => {
        for (const angle of CAMERA.azimuthsDeg) {
          const links = level.cameraAngles[angle];
          for (const [a, b] of [...links.waterLinks, ...links.walkLinks]) {
            expect(
              looksJoined(layout[a], layout[b], angle),
              `${level.name} @${angle}° 声明 ${a} 和 ${b} 接着,但模型里它们没对上`,
            ).toBe(true);
          }
        }
      });

      it("水路从源出发,一路都在往画面下方走", () => {
        // 规则 2。表格是无向的,方向由「从源开始漫」决定,所以这里跟着漫一遍,
        // 确认每一步都没有把水往上送。
        for (const angle of CAMERA.azimuthsDeg) {
          const links = level.cameraAngles[angle].waterLinks;
          const lowest = (id: string): number =>
            Math.min(...anchorsOf(layout[id]).map((p) => project(p, angle)[1]));
          const highest = (id: string): number =>
            Math.max(...anchorsOf(layout[id]).map((p) => project(p, angle)[1]));

          const seen = new Set<string>();
          const queue = level.pools.filter((p) => p.isSource).map((p) => p.id);
          while (queue.length > 0) {
            const here = queue.shift();
            if (here === undefined || seen.has(here)) continue;
            seen.add(here);
            for (const [a, b] of links) {
              const next = a === here ? b : b === here ? a : null;
              if (next === null || seen.has(next)) continue;
              expect(
                lowest(next),
                `${level.name} @${angle}°: 水从 ${here} 流到 ${next} 是在往画面上方爬`,
              ).toBeLessThanOrEqual(highest(here) + 1e-6);
              queue.push(next);
            }
          }
        }
      });

      it("解出来的那个角度,对齐得干净利落", () => {
        // 对齐要么是 0,要么明显不是 —— 中间地带说明摆放在靠容差过关,
        // 而容差是没人辩护得了的东西。
        for (const angle of CAMERA.azimuthsDeg) {
          for (const [a, b] of level.cameraAngles[angle].waterLinks) {
            let best = Infinity;
            for (const pa of anchorsOf(layout[a])) {
              for (const pb of anchorsOf(layout[b])) {
                const [ax, ay] = project(pa, angle);
                const [bx, by] = project(pb, angle);
                best = Math.min(best, Math.hypot(ax - bx, ay - by));
              }
            }
            expect(best, `${a}–${b} @${angle}° 差 ${best.toFixed(2)},在靠容差蒙混`).toBeLessThan(
              0.05,
            );
          }
        }
      });

      it("至少有一个角度是全断的,否则开局就通了", () => {
        const dead = CAMERA.azimuthsDeg.filter(
          (az: Azimuth) => level.cameraAngles[az].waterLinks.length === 0,
        );
        expect(dead.length, `${level.name} 没有任何一个角度是断开的`).toBeGreaterThan(0);
        expect(level.cameraAngles[level.opensAt].waterLinks).toEqual([]);
      });
    });
  }
});
