// 场景图的空间法则,量在真正画出去的那份几何上。
//
// `spec/iso.test.ts` 检查的是**表格和摆放是否一致**(声明连通的两端投影是否重
// 合)。这个文件检查的是另一件事:摆放本身是否守 `CLAUDE.md` §3.1/§3.5 的空间
// 法则 —— 位置在不在格点上、池子是不是内嵌、有没有关卡数据之外的即兴装饰。
//
// 两者都接不住对方:一堆违规的小数偏移完全可以投影得严丝合缝,而一份格点完美
// 的摆放也完全可以把渠口接错池子。
//
// 这里不起 WebGL:jsdom 里 `new WebGLRenderer()` 起不来,所以 `buildWorld` 是
// 和 renderer 分开的。量的是真正那份场景图,不是另写一份「应该是这样」——
// 后者只会两边一起漂。

import { Box3, BoxGeometry, CylinderGeometry, Mesh, Scene, SphereGeometry } from "three";
import { describe, expect, it } from "vitest";
import { level1, level1Layout } from "../src/levels/level1.ts";
import type { Layout } from "../src/iso.ts";
import type { Level } from "../src/rules.ts";
import { buildWorld } from "../src/scene.ts";

/** §3.1:一个 tile = 一个 Three.js 世界单位。全项目没有第二个换算比。 */
const TILE = 1;

/** 位置允许落在半 tile 的格点上 —— 半格是因为一块 1 tile 的东西居中摆时,
 *  它的边就在半格上。比这更细的偏移就是 §3.1 禁止的「手调数值」。 */
const LATTICE = 0.5 * TILE;

/**
 * 每种东西允许用几个 primitive。**这是预算,不是观察值。**
 *
 * 调高任何一个数都必须是一次有意的决定 —— 「多一个都算红」的意义就在这里:
 * 渲染器不许即兴加装饰(§3.5「没有关卡数据之外的几何」)。
 */
const BUDGET = {
  /** §3.5:主体 + 顶面薄板 + 檐口。至少三件,也就三件。 */
  platform: 3,
  /** §3.5:一个内嵌的圆柱,直径 0.8 TILE。就一个。 */
  pool: 1,
  /** 槽底 + 两道边墙 + 满水 + 半水。
   *
   *  满水和半水非得是两件不可:规则 4 要求「水流到一半停住、末端悬空」是一个
   *  **可见状态**,那就得有两个能各自显隐的 mesh。边墙留着是因为空渠得看得出
   *  是「一条现在还空着的路」—— 那个轮廓替代了文字教程。 */
  channel: 5,
  /** 兽:body / head / snout / tail / 四条腿。它是唯一的角色,不是布景;
   *  §3.5 把它列进几何词汇表但没给 primitive 上限。 */
  beast: 8,
} as const;

/** §3.5:一切都由 Three.js 内置 primitive 搭出来,而且只有这几种。 */
const ALLOWED_GEOMETRY = new Set(["BoxGeometry", "CylinderGeometry", "SphereGeometry"]);

const LEVELS: { name: string; level: Level; layout: Layout }[] = [
  { name: "level1", level: level1, layout: level1Layout },
];

type Built = ReturnType<typeof buildWorld>;

/** 起一个真场景,把世界挂进去,把矩阵算好。 */
function stage(level: Level, layout: Layout): { scene: Scene; built: Built } {
  const scene = new Scene();
  const built = buildWorld(level, layout);
  scene.add(built.world);
  scene.updateMatrixWorld(true);
  return { scene, built };
}

function meshesIn(root: { traverse: (fn: (o: unknown) => void) => void }): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

function onLattice(v: number): boolean {
  return Math.abs(v / LATTICE - Math.round(v / LATTICE)) < 1e-9;
}

/** 一个 mesh 的可读名字,用来把红项说清楚。 */
function label(m: Mesh): string {
  const g = m.geometry as { type?: string };
  return m.name || g.type || "mesh";
}

for (const { name, level, layout } of LEVELS) {
  describe(`${name} 的场景图守空间法则`, () => {
    // —— 1. 位置只落在格点上 ——
    it("把每个 mesh 的 position 放在半 tile 的格点上", () => {
      const { built } = stage(level, layout);
      // §3.1:「不许有小数偏移、手调微调、位置里的魔数」。亚 tile 的细节属于
      // 几何自己的原点和尺寸,不属于 position —— 规格原话是「对齐问题靠改几何
      // 的原点或尺寸来修,永远不靠挪位置」。
      const strays = meshesIn(built.world)
        .filter(
          (m) => !onLattice(m.position.x) || !onLattice(m.position.y) || !onLattice(m.position.z),
        )
        .map(
          (m) =>
            `${label(m)} @ (${m.position.x.toFixed(3)}, ${m.position.y.toFixed(3)}, ${m.position.z.toFixed(3)})`,
        );
      expect(strays, `这些 mesh 的 position 不在 ${LATTICE} 的格点上`).toEqual([]);
    });

    // —— 2. 池子是内嵌的圆柱,直径 0.8 TILE ——
    it("把每个池子做成半径 0.4 TILE 的圆柱", () => {
      const { built } = stage(level, layout);
      expect(built.poolWater.size, "每个池子都要有一个水面").toBe(level.pools.length);
      for (const [id, mesh] of built.poolWater) {
        expect(mesh.geometry, `${id} 的池子不是圆柱`).toBeInstanceOf(CylinderGeometry);
        const p = (mesh.geometry as CylinderGeometry).parameters;
        expect(p.radiusTop, `${id} 的池子半径不是 0.4 TILE`).toBeCloseTo(0.4 * TILE, 9);
        expect(p.radiusBottom, `${id} 的池子不是等宽圆柱`).toBeCloseTo(0.4 * TILE, 9);
      }
    });

    it("每块露台都砌到地面,没有一块飘在空中", () => {
      // §3.5:「侧面是主体的实心挤出」。柱廊被拆掉之后,y=1 那几块露台底下
      // 一度什么都没有 —— 画面上它们悬空,而悬空的东西读不出重量,整座塔就
      // 不像塔。这条只问一件事:每块露台的最低点有没有到地。
      const { built } = stage(level, layout);
      for (const p of level.platforms) {
        const piece = built.pieces.get(p.id);
        expect(piece, `${p.id} 没有被建出来`).toBeTruthy();
        const bottom = new Box3().setFromObject(piece as never).min.y;
        expect(
          bottom,
          `${p.id} 的底在 y=${bottom.toFixed(3)},离地还有 ${bottom.toFixed(3)} —— 它是飘着的`,
        ).toBeLessThanOrEqual(1e-9);
      }
    });

    it("把每个池子嵌进它所在的平台里,不让它凸出来", () => {
      const { built } = stage(level, layout);
      for (const p of level.pools) {
        // 「所在平台」是数据说的(`pool.on`),不是这里比坐标猜出来的 —— 猜出来
        // 的版本会把池子自己算进候选,变成拿自己和自己比。
        expect(p.on, `${p.id} 没声明它嵌在哪块砖里`).toBeTruthy();
        const deck = built.pieces.get(p.on as string);
        expect(deck, `${p.id} 声明的 ${p.on} 不存在`).toBeTruthy();

        const water = built.poolWater.get(p.id);
        expect(water, `${p.id} 没有水面`).toBeTruthy();

        // 池沿 = 那块砖最高的一点。水面必须在它之下 —— 这就是「内嵌」的全部
        // 含义:一个盆里的水面低于盆沿。
        const rim = new Box3().setFromObject(deck as never).max.y;
        const top = new Box3().setFromObject(water as never).max.y;
        expect(
          top,
          `${p.id} 的水面 (${top.toFixed(3)}) 高过 ${p.on} 的池沿 (${rim.toFixed(3)}) —— 是凸出来的,不是内嵌`,
        ).toBeLessThanOrEqual(rim + 1e-9);
      }
    });

    // —— 3. mesh 总数由关卡数据算得出,多一个都算红 ——
    it("只画关卡数据说了的东西,一个不多", () => {
      const { built } = stage(level, layout);

      const actual = {
        platform: level.platforms.reduce(
          (n, p) => n + meshesIn(built.pieces.get(p.id) ?? new Scene()).length,
          0,
        ),
        pool: level.pools.reduce(
          (n, p) => n + meshesIn(built.pieces.get(p.id) ?? new Scene()).length,
          0,
        ),
        channel: level.channels.reduce(
          (n, c) => n + meshesIn(built.pieces.get(c.id) ?? new Scene()).length,
          0,
        ),
        beast: meshesIn(built.beast).length,
      };
      const want = {
        platform: BUDGET.platform * level.platforms.length,
        pool: BUDGET.pool * level.pools.length,
        channel: BUDGET.channel * level.channels.length,
        beast: BUDGET.beast,
      };

      // 先逐项对,红起来才说得清是哪一种东西超了预算。
      expect(actual).toEqual(want);

      // 再对总数 —— 上面逐项都对、总数还不对,说明有 mesh 挂在任何一件关卡
      // 数据之外,那正是「渲染器即兴加装饰」。
      const total = Object.values(want).reduce((a, b) => a + b, 0);
      expect(meshesIn(built.world).length, "有 mesh 不属于任何一件关卡数据").toBe(total);
    });

    // —— 4. 几何类型白名单 ——
    it("只用白名单里的内置 primitive", () => {
      const { built } = stage(level, layout);
      const strays = [
        ...new Set(
          meshesIn(built.world)
            .map((m) => (m.geometry as { type: string }).type)
            .filter((t) => !ALLOWED_GEOMETRY.has(t)),
        ),
      ];
      expect(strays, "§3.5 只允许内置 primitive,而且只这几种").toEqual([]);
    });
  });
}

// 白名单本身要有意义:列进去的类型必须真的存在,否则一次打错字就把检查变成
// 空转。
describe("白名单指向真实的几何类型", () => {
  it("每个名字都对得上一个 Three.js 构造器", () => {
    const real = new Set(
      [new BoxGeometry(), new CylinderGeometry(), new SphereGeometry()].map((g) => g.type),
    );
    for (const nameOfType of ALLOWED_GEOMETRY) expect(real).toContain(nameOfType);
  });
});
