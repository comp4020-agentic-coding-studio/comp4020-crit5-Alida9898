import { describe, expect, it } from "vitest";
import { level1 } from "../src/levels/level1.ts";
import type { Level, PortId, State, Turn } from "../src/rules.ts";
import {
  begin,
  canWalkTo,
  fillingNow,
  finalPoolFull,
  halfFilled,
  pour,
  reachable,
  standingOnPool,
  turn as turnPart,
  walkableFrom,
} from "../src/rules.ts";

// 五条规则,作为测试。
//
// 其中两条最容易被一次「顺手统一一下」删掉,所以钉得最死:半满的渠**不可行走**,
// 以及灌满不可逆而可行走**是**可逆的。谁哪天想把「满」和「通」合并成一个布尔,
// 会在这里被拦下来。

const LEVELS: Level[] = [level1];

/** 把兽放到某处、砖块转到某档的状态。 */
function at(where: PortId, elbow: Turn = 3, filled: PortId[] = []): State {
  const s = begin(level1);
  return {
    ...s,
    beastAt: where,
    filled: new Set(filled),
    config: { ...s.config, turns: { elbow } },
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
    const s = at("springA");
    expect(standingOnPool(level1, s)).toBe("springA");
    expect(fillingNow(level1, s)).toContain("span");
  });

  it("水从兽脚下那个池子出发,不是从某个固定的源头", () => {
    // 任何池子都能当水源。从下游的泉眼引水,只会往它的下游走。
    const fromB = reachable(level1, at("springB", 0));
    expect(fromB.has("spout")).toBe(true);
    expect(fromB.has("springA"), "水倒着流回上游了").toBe(false);
  });

  it("兽离开之后,已经发生的不回退", () => {
    const poured = pour(level1, at("springA"));
    expect(poured.filled.has("span")).toBe(true);
    const left = pour(level1, { ...poured, beastAt: "birth" });
    expect(left.filled.has("span"), "兽一走渠就空了").toBe(true);
  });
});

describe("规则 2 与 4:两端都锚住才算灌满", () => {
  it("两端都是池子的渠,引水就灌满", () => {
    expect(fillingNow(level1, at("springA"))).toEqual(["span"]);
  });

  it("同一次引水里,水会继续流进下一段渠然后停住", () => {
    // 从泉眼 A 放水,水灌满 span、漫过泉眼 B、再流进 spout —— 而 spout 的
    // 下游口还悬着,于是水停在那儿。玩家第一次引水就看见了这个失败态,
    // 不用等到第六步。这是对的物理,不要写逻辑去拦它。
    expect(halfFilled(level1, at("springA"))).toEqual(["spout"]);
  });

  it("下游端悬空时,水停在渠里 —— 这是允许发生的状态", () => {
    // 砖没转正,spout 的下游口谁也接不到。水进得去,出不来。
    const s = at("springB", 3);
    expect(fillingNow(level1, s), "不该算灌满").toEqual([]);
    expect(halfFilled(level1, s), "应该半满且末端悬空").toEqual(["spout"]);
    expect(pour(level1, s).filled.size, "半满不该被记成灌满").toBe(0);
  });

  it("砖转正之后同一次引水就灌满了", () => {
    const s = at("springB", 0);
    expect(fillingNow(level1, s)).toEqual(["spout"]);
    expect(halfFilled(level1, s)).toEqual([]);
  });

  it("灌满不可逆:之后再怎么转砖也不会变空", () => {
    let s = pour(level1, at("springB", 0));
    expect(s.filled.has("spout")).toBe(true);
    for (const elbow of [1, 2, 3, 0] as Turn[]) {
      s = pour(level1, { ...s, config: { ...s.config, turns: { elbow } } });
      expect(s.filled.has("spout"), "已灌满的渠被排空了").toBe(true);
    }
  });
});

describe("规则 5:空渠不能走,灌满的能走 —— 但「满」不等于「通」", () => {
  it("空渠站不上去、走不过去", () => {
    // 这是本作最核心的一条。断口那头在渠灌满之前是到不了的。
    const dry = at("springA");
    expect(walkableFrom(level1, dry, "springA").has("springB")).toBe(false);
    expect(canWalkTo(level1, dry, "springB")).toBe(false);
  });

  it("灌满之后水面就是路面", () => {
    const bridged = pour(level1, at("springA"));
    expect(bridged.filled.has("span")).toBe(true);
    expect(canWalkTo(level1, bridged, "springB"), "桥造好了却走不过去").toBe(true);
  });

  it("满了、但那个角度下看起来是断的,就还是走不过去", () => {
    // 「满」是水的状态,「通」是画面的状态,谁也不蕴含谁。把这两件事合并成
    // 一个布尔是最诱人的简化,而那会把这个游戏删掉。
    const full = at("springB", 3, ["span", "spout"]);
    expect(full.filled.has("spout"), "它是满的").toBe(true);
    expect(canWalkTo(level1, full, "grandBasin"), "但这个朝向下走不过去").toBe(false);

    const aligned = { ...full, config: { ...full.config, turns: { elbow: 0 as Turn } } };
    expect(canWalkTo(level1, aligned, "grandBasin"), "转正了就该走得过去").toBe(true);
  });
});

describe("通关是大池被填满,不是水抵达", () => {
  it("开局没通关", () => {
    for (const level of LEVELS) {
      expect(finalPoolFull(level, begin(level))).toBe(false);
    }
  });

  it("水只是漫到大池、渠没灌满,不算通关", () => {
    const s = at("springB", 3);
    expect(finalPoolFull(level1, pour(level1, s))).toBe(false);
  });

  it("照着设计的流程走一遍能通关", () => {
    // 出生点 → 走到泉眼 A → 引水造桥 → 踩水走到泉眼 B → 转砖 → 再引水。
    let s = begin(level1);
    expect(canWalkTo(level1, s, "springA"), "第一段路本该是通的").toBe(true);

    s = { ...s, beastAt: "springA" };
    s = pour(level1, s);
    expect(s.filled.has("span"), "引水没造出桥").toBe(true);

    expect(canWalkTo(level1, s, "springB"), "桥造好了却过不去").toBe(true);
    s = { ...s, beastAt: "springB" };

    // 先试着直接引水:水会停在渠里,末端悬空。这一步是设计里要玩家看见的。
    const stalled = pour(level1, s);
    expect(halfFilled(level1, stalled)).toEqual(["spout"]);
    expect(finalPoolFull(level1, stalled)).toBe(false);

    s = turnPart(stalled, "elbow");
    s = pour(level1, s);
    expect(finalPoolFull(level1, s), "转正再引水之后大池该满了").toBe(true);
  });
});
