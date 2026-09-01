// 五条规则,全是对手写表的查询。
//
// 这里每一个函数都只在查表。没有投影,没有射线,没有包围盒:「这两端看起来
// 接着」是关卡数据做出的声明,这个文件只负责读它。如果哪天这里的函数开始需要
// 一个坐标,说明上游出错了。

import type { Azimuth } from "./config/style.ts";

export type PortId = string;
export type PartId = string;
export type Turn = 0 | 1 | 2 | 3;

/** `isSource` 不再存在:任何池子都能当水源,取决于兽站在哪一个上面。 */
export type Pool = { id: PortId; isFinal?: boolean; grand?: boolean };
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

/** 可行走的连接。无向 —— 兽本来就能原路走回去。 */
export type Link = { between: [PortId, PortId]; when: When };

/**
 * 水路的连接。**有向**:水只从 `from` 流向 `to`。
 *
 * 方向必须写在数据里,不能在运行时比较屏幕高度 —— 那就成了几何运算,架构约束
 * 明令禁止。而它又非有不可:任何池子都能当水源,一旦从下游的池子引水,无向的
 * 边会让水倒着流回上游。作者在写这张表时保证 `to` 在画面上确实更低,
 * `spec/iso.test.ts` 把每一条都投影核对一遍。
 */
export type Flow = { from: PortId; to: PortId; when: When };

export type Level = {
  name: string;
  pools: Pool[];
  channels: Channel[];
  platforms: Platform[];
  tapPoints: TapPoint[];
  /** 可转的砖块。 */
  parts: PartId[];
  /** 看起来水路相连的端口对,有向。 */
  waterLinks: Flow[];
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

/** 水的下游邻居。只看 from → to,所以水绝不会倒流。 */
function downstream(level: Level, config: Config, from: PortId): PortId[] {
  return level.waterLinks
    .filter((f) => f.from === from && holds(f.when, config))
    .map((f) => f.to);
}

/** 兽此刻是不是正站在一个池子上 —— 能不能引水,就看这个。 */
export function standingOnPool(level: Level, state: State): PortId | null {
  const at = state.beastAt;
  if (!at) return null;
  return level.pools.some((p) => p.id === at) ? at : null;
}

/**
 * 规则 1、2:从某个池子放水,能漫到哪些端口。
 *
 * 只沿声明的 from → to 走,所以水绝不会往回爬。没有几何运算,只有查表。
 */
export function reachableFrom(level: Level, state: State, source: PortId): Set<PortId> {
  const wet = new Set<PortId>();
  const queue = [source];
  while (queue.length > 0) {
    const here = queue.shift();
    if (here === undefined || wet.has(here)) continue;
    wet.add(here);
    for (const next of downstream(level, state.config, here)) {
      if (!wet.has(next)) queue.push(next);
    }
  }
  return wet;
}

/** 兽现在站的池子放出的水,漫到哪儿。没站在池子上就哪儿也不漫。 */
export function reachable(level: Level, state: State): Set<PortId> {
  const source = standingOnPool(level, state);
  return source ? reachableFrom(level, state, source) : new Set<PortId>();
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
 * **不要加逻辑去阻止它发生,也不要在这种情况下弹提示。**
 */
export function halfFilled(level: Level, state: State): PortId[] {
  const wet = reachable(level, state);
  return level.channels
    .filter((c) => !state.filled.has(c.id))
    .filter((c) => wet.has(c.id) && !c.ends.every((end) => wet.has(end)))
    .map((c) => c.id);
}

/**
 * 按空格:从兽脚下的池子放水。
 *
 * 规则 4:灌满不可逆,所以这里只加不减 —— 之后再怎么转砖块,已经灌满的渠
 * 也不会变空。
 */
export function pour(level: Level, state: State): State {
  const filled = new Set(state.filled);
  for (const id of fillingNow(level, state)) filled.add(id);
  return { ...state, filled };
}

/** 保留旧名字,行为同 `pour`。 */
export const settle = pour;

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
