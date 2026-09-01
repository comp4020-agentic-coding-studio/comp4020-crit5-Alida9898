// 五条规则,全是对手写表的查询。
//
// 这里每一个函数都只在查表。没有投影,没有射线,没有包围盒:「这两端看起来
// 接着」是关卡数据做出的声明,这个文件只负责读它。如果哪天这里的函数开始需要
// 一个坐标,说明上游出错了。

import type { Azimuth } from "./config/style.ts";

export type PortId = string;
export type PartId = string;
export type Turn = 0 | 1 | 2 | 3;

export type Pool = { id: PortId; isSource?: boolean; isFinal?: boolean };
export type Channel = { id: PortId; ends: [PortId, PortId] };
export type Platform = { id: PortId };
export type TapPoint = { id: PortId; on: PortId };

/** 一次「配置」:相机在哪、每块砖转到第几档。两者都是有限枚举。 */
export type Config = { camera: Azimuth; turns: Record<PartId, Turn> };

/**
 * 一条声明在什么配置下成立。**省略的项表示「不关心」。**
 *
 * 当前版本相机固定,所以所有声明只写 `turns`。将来把相机转回来时,给声明多填
 * 一个 `camera` 就够了 —— 下面的判定逻辑一行都不用改。这个字段的存在就是为了
 * 让那次改动是免费的。
 */
export type When = { camera?: Azimuth; turns?: Partial<Record<PartId, Turn>> };

export type Link = { between: [PortId, PortId]; when: When };

export type Level = {
  name: string;
  pools: Pool[];
  channels: Channel[];
  platforms: Platform[];
  tapPoints: TapPoint[];
  /** 可转的砖块。 */
  parts: PartId[];
  /** 看起来水路相连的端口对。 */
  waterLinks: Link[];
  /** 看起来可以走过去的端口对。引用了渠的,只在该渠灌满后生效(规则 5)。 */
  walkLinks: Link[];
  /** 开局的配置。 */
  opens: Config;
  beastAt?: PortId;
};

/** 玩起来会变的东西,只有这些。 */
export type State = {
  config: Config;
  /** 已灌满的渠。规则 4:灌满不可逆,所以这个集合只增不减。 */
  filled: Set<PortId>;
  beastAt?: PortId;
};

export function begin(level: Level): State {
  return {
    config: { camera: level.opens.camera, turns: { ...level.opens.turns } },
    filled: new Set(),
    beastAt: level.beastAt,
  };
}

/** 一次转动:某块砖前进一档。旋转是枚举,不是角度。 */
export function turn(state: State, part: PartId): State {
  const now = state.config.turns[part] ?? 0;
  return {
    ...state,
    config: {
      ...state.config,
      turns: { ...state.config.turns, [part]: ((now + 1) % 4) as Turn },
    },
  };
}

/** 这条声明在当前配置下成立吗。 */
export function holds(when: When, config: Config): boolean {
  if (when.camera !== undefined && when.camera !== config.camera) return false;
  for (const [part, at] of Object.entries(when.turns ?? {})) {
    if (config.turns[part] !== at) return false;
  }
  return true;
}

function liveLinks(links: Link[], config: Config): [PortId, PortId][] {
  return links.filter((l) => holds(l.when, config)).map((l) => l.between);
}

/** 某个端口在这批连接下的邻居(无向)。 */
function neighbours(links: [PortId, PortId][], from: PortId): PortId[] {
  const out: PortId[] = [];
  for (const [a, b] of links) {
    if (a === from) out.push(b);
    else if (b === from) out.push(a);
  }
  return out;
}

/**
 * 规则 3:兽站在取水点上,水才流。
 *
 * 完全没有取水点的关卡,水从第一帧就在流。
 */
export function sourcesRunning(level: Level, state: State): boolean {
  if (level.tapPoints.length === 0) return true;
  return level.tapPoints.some((tap) => tap.id === state.beastAt);
}

/**
 * 规则 1、2:当前配置下,水漫得到哪些端口。
 */
export function reachable(level: Level, state: State): Set<PortId> {
  const wet = new Set<PortId>();
  if (!sourcesRunning(level, state)) return wet;

  const links = liveLinks(level.waterLinks, state.config);
  const queue = level.pools.filter((p) => p.isSource).map((p) => p.id);

  while (queue.length > 0) {
    const here = queue.shift();
    if (here === undefined || wet.has(here)) continue;
    wet.add(here);
    for (const next of neighbours(links, here)) {
      if (!wet.has(next)) queue.push(next);
    }
  }
  return wet;
}

/** 规则 4:两端都锚到池子的渠 —— 这些会灌满。 */
export function fillingNow(level: Level, state: State): PortId[] {
  const wet = reachable(level, state);
  return level.channels
    .filter((c) => wet.has(c.id) && c.ends.every((end) => wet.has(end)))
    .map((c) => c.id);
}

/**
 * 水进去了、但只有一端锚住的渠。
 *
 * 这是一个合法且重要的可见状态 —— 水停在渠里,末端悬空。
 * **不要加逻辑去阻止它发生。**
 */
export function halfFilled(level: Level, state: State): PortId[] {
  const wet = reachable(level, state);
  return level.channels
    .filter((c) => !state.filled.has(c.id))
    .filter((c) => wet.has(c.id) && !c.ends.every((end) => wet.has(end)))
    .map((c) => c.id);
}

/** 规则 4:灌满不可逆,所以这里只加不减。 */
export function settle(level: Level, state: State): State {
  const filled = new Set(state.filled);
  for (const id of fillingNow(level, state)) filled.add(id);
  return { ...state, filled };
}

/**
 * 规则 5:当前配置下、以现有的灌满情况,兽走得到哪里。
 *
 * 灌满的渠是路面 —— 但它照样受规则 1 管:只有在声明说它看起来接着的配置下才
 * 能走。「满」是水的状态,「通」是画面的状态,谁也不蕴含谁。
 */
export function walkableFrom(level: Level, state: State, from: PortId): Set<PortId> {
  const channels = new Set(level.channels.map((c) => c.id));
  const links = liveLinks(level.walkLinks, state.config).filter(([a, b]) =>
    // 提到某条渠的连接,在那条渠灌满之前是死的。
    [a, b].every((port) => !channels.has(port) || state.filled.has(port)),
  );

  const seen = new Set<PortId>();
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift();
    if (here === undefined || seen.has(here)) continue;
    seen.add(here);
    for (const next of neighbours(links, here)) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

export function canWalkTo(level: Level, state: State, to: PortId): boolean {
  if (state.beastAt === undefined) return false;
  return walkableFrom(level, state, state.beastAt).has(to);
}

/**
 * 通关条件是**终点大池被填满**,不是「水抵达终点」。
 * 一个池子算满,当且仅当所有通向它的渠都已灌满。
 */
export function finalPoolFull(level: Level, state: State): boolean {
  const final = level.pools.find((p) => p.isFinal);
  if (!final) return false;
  const feeding = level.channels.filter((c) => c.ends.includes(final.id));
  return feeding.length > 0 && feeding.every((c) => state.filled.has(c.id));
}
