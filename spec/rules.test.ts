import { describe, expect, it } from "vitest";
import { level1 } from "../src/levels/level1.ts";
import type { Azimuth } from "../src/config/style.ts";
import type { Level, PortId, State } from "../src/rules.ts";
import {
  begin,
  canWalkTo,
  fillingNow,
  finalPoolFull,
  halfFilled,
  pour,
  reachable,
  standingOnPool,
  turnCamera,
  walkableFrom,
} from "../src/rules.ts";
import { CAMERA } from "../src/config/style.ts";

// 五条规则,作为测试。
//
// 其中两条最容易被一次「顺手统一一下」删掉,所以钉得最死:半满的渠**不可行走**,
// 以及灌满不可逆而可行走**是**可逆的。谁哪天想把「满」和「通」合并成一个布尔,
// 会在这里被拦下来。

const LEVELS: Level[] = [level1];

// 开局角度、以及「解开」的那个角度,都从关卡数据里读出来,不写死。
//
// 写死的那一版是这么坏的:渠口和大池的位置一改,解开的角度从 135° 变成 225°,
// 于是这个文件里七条规则测试同时变红 —— 而红的原因是常数过期,不是规则坏了。
// 规则测试要盯的是规则,不是坐标。
const OPENS: Azimuth = level1.opens.camera;

/** 唯一那条挑角度的水路,是它把大池接上的 —— 那个角度就是这一关的解。 */
const SOLVED: Azimuth = (() => {
  const picky = level1.waterLinks.find((l) => l.when.camera !== undefined);
  if (!picky?.when.camera) throw new Error("第一关没有任何一条水路挑相机角度,它就没有解了");
  return picky.when.camera;
})();

/** 把兽放到某处、相机转到某个角度的状态。 */
function at(where: PortId, camera: Azimuth = OPENS, filled: PortId[] = []): State {
  const s = begin(level1);
  return {
    ...s,
    beastAt: where,
    filled: new Set(filled),
    config: { ...s.config, camera },
  };
}

describe("数据本身自洽", () => {
  it("只提到真实存在的端口", () => {
    for (const level of LEVELS) {
      const known = new Set<PortId>([
        ...level.pools.map((p) => p.id),
        ...level.channels.map((c) => c.id),
        ...level.platforms.map((p) => p.id),
      ]);
      for (const f of level.waterLinks) {
        expect(known, `${level.name}: ${f.from}`).toContain(f.from);
        expect(known, `${level.name}: ${f.to}`).toContain(f.to);
      }
      for (const l of level.walkLinks) {
        for (const port of l.between) expect(known, `${level.name}: ${port}`).toContain(port);
      }
    }
  });

  it("每条渠都锚在两个真的池子上", () => {
    for (const level of LEVELS) {
      const pools = new Set(level.pools.map((p) => p.id));
      for (const c of level.channels) {
        for (const end of c.ends) {
          expect(pools, `${c.id} 的一端 ${end} 不是池子`).toContain(end);
        }
      }
    }
  });

  it("每条声明的条件只提到这一关真有的砖块", () => {
    for (const level of LEVELS) {
      const parts = new Set(level.parts);
      const whens = [...level.waterLinks.map((f) => f.when), ...level.walkLinks.map((l) => l.when)];
      for (const when of whens) {
        for (const part of Object.keys(when.turns ?? {})) {
          expect(parts, `${level.name}: 没有这块砖 ${part}`).toContain(part);
        }
      }
    }
  });

  it("恰好有一个终点大池", () => {
    for (const level of LEVELS) {
      expect(level.pools.filter((p) => p.isFinal)).toHaveLength(1);
    }
  });
});

describe("规则 3:兽站在池子上,水才流", () => {
  it("站在出生点上,按空格什么也不会发生", () => {
    const s = at("birth");
    expect(standingOnPool(level1, s)).toBeNull();
    expect(reachable(level1, s).size).toBe(0);
    expect(pour(level1, s).filled.size).toBe(0);
  });

  it("站在泉眼上就能引水", () => {
    const s = at("spring", SOLVED);
    expect(standingOnPool(level1, s)).toBe("spring");
    expect(fillingNow(level1, s)).toContain("aqueduct");
  });

  it("水从兽脚下那个池子出发,不是从某个固定的源头", () => {
    // 任何池子都能当水源,而水只往声明的下游走 —— 从下游那个池子引水,
    // 水不会倒着爬回上游。这一关只有一条渠,所以用一块专门的小盘面来钉。
    const twoWay: Level = {
      name: "twoWay",
      pools: [{ id: "top" }, { id: "mid" }, { id: "low", isFinal: true }],
      channels: [
        { id: "upper", ends: ["top", "mid"] },
        { id: "lower", ends: ["mid", "low"] },
      ],
      platforms: [],
      tapPoints: [],
      parts: [],
      waterLinks: [
        { from: "top", to: "upper", when: {} },
        { from: "upper", to: "mid", when: {} },
        { from: "mid", to: "lower", when: {} },
        { from: "lower", to: "low", when: {} },
      ],
      walkLinks: [],
      opens: { camera: 45, turns: {} },
    };
    const fromMid = reachable(twoWay, { ...begin(twoWay), beastAt: "mid" });
    expect(fromMid.has("lower"), "该往下游走").toBe(true);
    expect(fromMid.has("upper"), "水倒着流回上游了").toBe(false);
    expect(fromMid.has("top"), "水倒着流回上游了").toBe(false);
  });

  it("兽离开之后,已经发生的不回退", () => {
    const poured = pour(level1, at("spring", SOLVED));
    expect(poured.filled.has("aqueduct")).toBe(true);
    const left = pour(level1, { ...poured, beastAt: "birth" });
    expect(left.filled.has("aqueduct"), "兽一走渠就空了").toBe(true);
  });
});

describe("规则 2 与 4:两端都锚住才算灌满", () => {
  it("开局那个角度下,水流进渠里就停住,末端悬空", () => {
    // 第一关的转折点:玩家按了空格,水动了,却没到大池。画面上唯一还没试过
    // 的东西就是方向键。不是 bug,不要写逻辑去拦,也不要弹提示。
    const s = at("spring", OPENS);
    expect(fillingNow(level1, s), "不该算灌满").toEqual([]);
    expect(halfFilled(level1, s), "应该半满且末端悬空").toEqual(["aqueduct"]);
    expect(pour(level1, s).filled.size, "半满不该被记成灌满").toBe(0);
  });

  it("转到对的视角之后,同一次引水就灌满了", () => {
    const s = at("spring", SOLVED);
    expect(fillingNow(level1, s)).toEqual(["aqueduct"]);
    expect(halfFilled(level1, s)).toEqual([]);
  });

  it("灌满不可逆:之后再怎么转视角也不会变空", () => {
    let s = pour(level1, at("spring", SOLVED));
    expect(s.filled.has("aqueduct")).toBe(true);
    for (const camera of [225, 315, 45, 135] as Azimuth[]) {
      s = pour(level1, { ...s, config: { ...s.config, camera } });
      expect(s.filled.has("aqueduct"), "已灌满的渠被排空了").toBe(true);
    }
  });
});

describe("规则 5:空渠不能走,灌满的能走 —— 但「满」不等于「通」", () => {
  it("空渠站不上去、走不过去", () => {
    // 本作最核心的一条:没水的渠只是一道石头凹槽。
    const dry = at("spring", SOLVED);
    expect(dry.filled.has("aqueduct")).toBe(false);
    expect(walkableFrom(level1, dry, "spring").has("aqueduct")).toBe(false);
    expect(canWalkTo(level1, dry, "grandBasin")).toBe(false);
  });

  it("灌满之后水面就是路面", () => {
    const bridged = pour(level1, at("spring", SOLVED));
    expect(bridged.filled.has("aqueduct")).toBe(true);
    expect(canWalkTo(level1, bridged, "aqueduct"), "灌满了却踩不上去").toBe(true);
    expect(canWalkTo(level1, bridged, "grandBasin"), "走不到大池").toBe(true);
  });

  it("满了、但那个角度下看起来是断的,就还是走不过去", () => {
    // 「满」是水的状态,「通」是画面的状态,谁也不蕴含谁。把这两件事合并成
    // 一个布尔是最诱人的简化,而那会把这个游戏删掉。
    const full = at("spring", OPENS, ["aqueduct"]);
    expect(full.filled.has("aqueduct"), "它是满的").toBe(true);
    expect(canWalkTo(level1, full, "grandBasin"), "但这个角度下走不过去").toBe(false);

    const aligned = { ...full, config: { ...full.config, camera: SOLVED } };
    expect(canWalkTo(level1, aligned, "grandBasin"), "转到对的角度就该走得过去").toBe(true);
  });
});

describe("第一关的解,离开局只有一下", () => {
  it("解开的那个角度就是开局角度的下一档", () => {
    // 规格:第一关「短到几乎不算谜题」。一下转到,才是一下;要按两下就不是了。
    const cycle = CAMERA.azimuthsDeg;
    const next = cycle[(cycle.indexOf(OPENS) + 1) % cycle.length];
    expect(SOLVED, `开局 ${OPENS}°,解在 ${SOLVED}°,不是一下能转到的`).toBe(next);
  });
});

describe("通关是大池被填满,不是水抵达", () => {
  it("开局没通关", () => {
    for (const level of LEVELS) {
      expect(finalPoolFull(level, begin(level))).toBe(false);
    }
  });

  it("水只是漫进渠里、没锚住两端,不算通关", () => {
    const s = at("spring", OPENS);
    expect(finalPoolFull(level1, pour(level1, s))).toBe(false);
  });

  it("照着设计的流程走一遍能通关", () => {
    // 只三步:走 → 引水(停住)→ 转相机 → 再引水。
    let s = begin(level1);

    // 1. 走。第一段路任何角度都是通的,不需要解谜。
    expect(canWalkTo(level1, s, "spring"), "第一段路本该是通的").toBe(true);
    s = { ...s, beastAt: "spring" };

    // 2. 引水。水动了,但停在渠里 —— 转折点。
    const stalled = pour(level1, s);
    expect(halfFilled(level1, stalled), "水该停在渠里").toEqual(["aqueduct"]);
    expect(stalled.filled.size, "这一下不该灌满任何东西").toBe(0);
    expect(finalPoolFull(level1, stalled)).toBe(false);

    // 3. 转相机。断开的那截接上了。
    s = turnCamera(stalled, CAMERA.azimuthsDeg);
    expect(s.config.camera).toBe(SOLVED);

    // 4. 再引水。渠灌满,大池填满。
    s = pour(level1, s);
    expect(s.filled.has("aqueduct")).toBe(true);
    expect(finalPoolFull(level1, s), "转到对的视角再引水之后大池该满了").toBe(true);

    // 而且现在渠面成了路,兽踩得过去。
    expect(canWalkTo(level1, s, "grandBasin"), "灌满了却走不过去").toBe(true);
  });
});
