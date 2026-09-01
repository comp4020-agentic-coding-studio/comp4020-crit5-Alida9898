// Three.js 层:釉砖平涂、正交等距、两盏灯。
//
// 相机站在 (D,D,D) 方向看向原点,那正是 `iso.ts` 里 `project` 实现的那个映射。
// 这不是靠人手动维持的巧合 —— 点击拾取用的是同一个 `project`,所以按钮落得准;
// 传感器也用它检查摆放。把相机挪出立方体对角线,三者就同时失效。
//
// 这里不做任何连通判定。它只负责画出「表格已经声明的东西」。

import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import { ACESFilmicToneMapping } from "three";
import { BACKGROUND, CAMERA, FORM, LIGHT, PALETTE, RENDER } from "./config/style.ts";
import type { Layout, Placement, Vec3 } from "./iso.ts";
import { project, turnedAround } from "./iso.ts";
import type { Level, PartId, PortId, Turn } from "./rules.ts";

/** 相机沿对角线退多远。正交投影下不影响画面,只要越过近裁面。 */
const D = 60;

const lambert = (colour: string): MeshLambertMaterial =>
  new MeshLambertMaterial({ color: colour });

/** 一块露台:主体、顶面薄板(亮一档)、檐口(略宽,暗一档)。
 *  单个 box 在固定光下会读成一张纸,规格明令不许。 */
function terrace(size: number, hue: keyof typeof PALETTE = "sandstone"): Group {
  const g = new Group();
  const tone = PALETTE[hue];

  const body = new Mesh(new BoxGeometry(size, FORM.terraceBody, size), lambert(tone.mid));
  g.add(body);

  const slab = new Mesh(
    new BoxGeometry(size * 0.94, FORM.terraceSlab, size * 0.94),
    lambert(tone.light),
  );
  slab.position.y = FORM.terraceBody / 2 + FORM.terraceSlab / 2;
  g.add(slab);

  const cornice = new Mesh(
    new BoxGeometry(size + FORM.corniceOverhang, FORM.corniceHeight, size + FORM.corniceOverhang),
    lambert(tone.dark),
  );
  cornice.position.y = -FORM.terraceBody / 2 - FORM.corniceHeight / 2;
  g.add(cornice);

  return g;
}

/** 分段柱子,不是一根等宽圆柱。 */
function column(height: number): Group {
  const g = new Group();
  const each = height / FORM.columnSegments;
  for (let i = 0; i < FORM.columnSegments; i++) {
    const r = FORM.columnRadius * (1 - i * 0.08);
    const drum = new Mesh(
      new CylinderGeometry(r, r * 1.06, each * 0.92, 8),
      lambert(i % 2 === 0 ? PALETTE.sandstone.mid : PALETTE.sandstone.dark),
    );
    drum.position.y = -each * (i + 0.5);
    g.add(drum);
  }
  return g;
}

/** 一段砖砌水渠:两道侧壁夹着一条水。水是独立的物体,不是把渠染蓝 —— 后者
 *  会让水淹掉砖,读起来就不再是「某个东西里面的水」。 */
function channel(from: Vec3, to: Vec3): { group: Group; water: Mesh; half: Mesh } {
  const g = new Group();
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const span = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  const mid: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];

  // 空渠必须看得出是「一条潜在的路,只是现在是空的」:两道立起来的边墙夹着
  // 一条凹下去的槽底。没有这个轮廓,断口那头就只是一片虚空,玩家不会想到
  // 「这里本来能过」—— 这个形状替代了文字教程。
  const floor = new Mesh(
    new BoxGeometry(FORM.channelWidth, FORM.channelWall * 0.7, span),
    lambert(PALETTE.sandstone.dark),
  );
  floor.rotation.y = angle;
  floor.position.set(mid[0], mid[1] - FORM.channelWall * 0.5, mid[2]);
  g.add(floor);

  for (const side of [-1, 1]) {
    const wall = new Mesh(
      new BoxGeometry(FORM.channelWall, FORM.channelWall * 2.1, span),
      lambert(PALETTE.sandstone.mid),
    );
    wall.rotation.y = angle;
    // 边墙沿着渠的法线方向让开半个渠宽。
    const nx = Math.cos(angle) * side * (FORM.channelWidth / 2);
    const nz = -Math.sin(angle) * side * (FORM.channelWidth / 2);
    wall.position.set(mid[0] + nx, mid[1] + FORM.channelWall * 0.25, mid[2] + nz);
    g.add(wall);
  }

  // 灌满的水:整条。
  const water = new Mesh(
    new BoxGeometry(FORM.channelWidth - FORM.waterInset * 2, FORM.channelWall, span),
    lambert(PALETTE.lapis.mid),
  );
  water.rotation.y = angle;
  water.position.set(mid[0], mid[1] + FORM.channelWall * 0.5, mid[2]);
  water.visible = false;
  g.add(water);

  // 半满的水:只有靠源那半截,末端明明白白悬空。规格要求这是可见状态。
  const half = new Mesh(
    new BoxGeometry(FORM.channelWidth - FORM.waterInset * 2, FORM.channelWall, span * 0.55),
    lambert(PALETTE.lapis.mid),
  );
  half.rotation.y = angle;
  half.position.set(
    from[0] + dx * 0.275,
    mid[1] + FORM.channelWall * 0.5,
    from[2] + dz * 0.275,
  );
  half.visible = false;
  g.add(half);

  return { group: g, water, half };
}

export type Stage = {
  render: () => void;
  step: (dt: number) => void;
  /** 把砖块摆到某个配置。转动是动画,期间外部应当封锁输入。 */
  setTurns: (turns: Record<PartId, Turn>) => void;
  /** 哪些渠灌满了、哪些半满、哪些池子有水。 */
  setWater: (filled: Set<PortId>, half: PortId[], wet: Set<PortId>) => void;
  setBeast: (port: PortId) => void;
  /** 某个 port 在画面上的位置(0–1),给 DOM 按钮定位用。用的是同一个投影。 */
  toScreen: (port: PortId) => { x: number; y: number };
  resize: (w: number, h: number) => void;
  dispose: () => void;
};

export function createStage(canvas: HTMLCanvasElement, level: Level, layout: Layout): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: RENDER.antialias, alpha: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = RENDER.toneMappingExposure;

  const scene = new Scene();

  // 两盏灯,只有两盏。方向光钉在世界里 —— 如果它跟着相机,每个面在转动中
  // 亮度不变,建筑正好在玩家盯着看的时候变平。
  const sun = new DirectionalLight("#ffffff", LIGHT.sunIntensity);
  sun.position.set(...LIGHT.sunDirection);
  scene.add(sun);
  scene.add(new AmbientLight("#ffffff", LIGHT.ambientIntensity));

  const world = new Group();
  scene.add(world);

  // 取景:把所有 port 在所有配置下的投影都框进来,免得转到某一档就跑出画外。
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const note = (p: Vec3): void => {
    const [x, y] = project(p, level.opens.camera);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const place of Object.values(layout.ports)) {
    const raw: Vec3[] = "at" in place ? [place.at] : [place.from, place.to];
    for (const p of raw) {
      note(p);
      const pivot = place.part ? layout.pivots[place.part] : undefined;
      if (pivot) for (const t of [1, 2, 3] as Turn[]) note(turnedAround(p, pivot, t));
    }
  }
  const pad = 0.85;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 + pad;

  const camera = new OrthographicCamera(
    midX - half,
    midX + half,
    midY + half,
    midY - half,
    0.1,
    400,
  );
  {
    const az = (level.opens.camera * Math.PI) / 180;
    const pitch = (CAMERA.pitchDeg * Math.PI) / 180;
    camera.position.set(
      D * Math.cos(pitch) * Math.cos(az),
      D * Math.sin(pitch),
      D * Math.cos(pitch) * Math.sin(az),
    );
  }
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  // ——— 建 ———

  type Turning = { group: Group; part: PartId; shown: number; target: number };
  const turning: Turning[] = [];
  const pieces = new Map<PortId, Group>();
  const waters = new Map<PortId, { full: Mesh; half: Mesh }>();
  const poolWater = new Map<PortId, Mesh>();

  /** 把一个 group 挂到它所属的砖块下,这样转动时它跟着走。 */
  function mount(group: Group, place: Placement): void {
    const part = place.part;
    if (!part) {
      world.add(group);
      return;
    }
    let host = turning.find((t) => t.part === part);
    if (!host) {
      const g = new Group();
      const pivot = layout.pivots[part];
      g.position.set(...pivot);
      world.add(g);
      host = { group: g, part, shown: 0, target: 0 };
      turning.push(host);
    }
    // 砖块 group 以轴心为原点,所以内容要减去轴心。
    const pivot = layout.pivots[part];
    group.position.sub({ x: pivot[0], y: pivot[1], z: pivot[2] } as never);
    host.group.add(group);
  }

  for (const platform of level.platforms) {
    const place = layout.ports[platform.id];
    if (!place || !("at" in place)) continue;
    const g = terrace(FORM.terraceSize * (platform.id === "ground" ? 2.4 : 1));
    g.position.set(...place.at);
    if (platform.id !== "ground") {
      const legs = column(FORM.pierLength);
      legs.position.set(place.at[0], place.at[1] - FORM.terraceBody / 2, place.at[2]);
      world.add(legs);
    }
    mount(g, place);
    pieces.set(platform.id, g);
  }

  for (const pool of level.pools) {
    const place = layout.ports[pool.id];
    if (!place || !("at" in place)) continue;
    const g = new Group();
    // 终点大池:更大、更精致、带一圈装饰角柱 —— 玩家一眼认得出目标在哪。
    const scale = pool.grand ? 1.5 : 1;
    g.add(terrace(FORM.terraceSize * scale, pool.grand ? "ochre" : "sandstone"));
    if (pool.grand) {
      for (const [cx, cz] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const post = new Mesh(
          new CylinderGeometry(0.075, 0.09, 0.42, 8),
          lambert(PALETTE.ochre.light),
        );
        post.position.set(
          (cx * FORM.terraceSize * scale) / 2.4,
          FORM.terraceBody / 2 + 0.21,
          (cz * FORM.terraceSize * scale) / 2.4,
        );
        g.add(post);
      }
    }
    // 池子里的水面。泉眼一直有水;终点大池开局是空的。
    const w = new Mesh(
      new BoxGeometry(FORM.terraceSize * scale * 0.62, 0.16, FORM.terraceSize * scale * 0.62),
      lambert(PALETTE.lapis.mid),
    );
    w.position.y = FORM.terraceBody / 2 + 0.02;
    w.visible = !pool.isFinal;
    g.add(w);
    poolWater.set(pool.id, w);
    g.position.set(...place.at);
    const legs = column(FORM.pierLength);
    legs.position.set(place.at[0], place.at[1] - FORM.terraceBody / 2, place.at[2]);
    world.add(legs);
    mount(g, place);
    pieces.set(pool.id, g);
  }

  for (const c of level.channels) {
    const place = layout.ports[c.id];
    if (!place || !("from" in place)) continue;
    const built = channel(place.from, place.to);
    waters.set(c.id, { full: built.water, half: built.half });
    mount(built.group, place);
    pieces.set(c.id, built.group);
  }

  // 兽:占位造型。穆什胡什的浮雕留到后面。
  const beast = new Group();
  {
    const body = new Mesh(new BoxGeometry(0.2, 0.26, 0.34), lambert(PALETTE.ochre.mid));
    body.position.y = 0.2;
    beast.add(body);
    const head = new Mesh(new SphereGeometry(0.12, 10, 8), lambert(PALETTE.ochre.light));
    head.position.set(0, 0.4, 0.16);
    beast.add(head);
    const tail = new Mesh(new BoxGeometry(0.06, 0.06, 0.24), lambert(PALETTE.ochre.dark));
    tail.position.set(0, 0.26, -0.26);
    beast.add(tail);
  }
  world.add(beast);

  // ——— 状态 ———

  function setTurns(turns: Record<PartId, Turn>): void {
    for (const t of turning) {
      const want = -((turns[t.part] ?? 0) * Math.PI) / 2;
      // 永远走最短的那一边,并且顺着点击的方向。
      let delta = want - (t.target % (Math.PI * 2));
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      t.target += delta;
    }
  }

  function setWater(filled: Set<PortId>, half: PortId[], wet: Set<PortId>): void {
    for (const [id, w] of waters) {
      w.full.visible = filled.has(id);
      w.half.visible = !filled.has(id) && half.includes(id);
    }
    for (const [id, w] of poolWater) {
      const pool = level.pools.find((p) => p.id === id);
      // 泉眼本来就是有水的;只有终点大池要等水灌进来。
      w.visible = pool?.isFinal ? wet.has(id) : true;
    }
  }

  function setBeast(port: PortId): void {
    const place = layout.ports[port];
    if (!place || !("at" in place)) return;
    beast.position.set(place.at[0], place.at[1] + FORM.terraceBody / 2, place.at[2]);
  }

  setTurns(level.opens.turns);
  for (const t of turning) {
    t.shown = t.target;
    t.group.rotation.y = t.shown;
  }
  if (level.beastAt) setBeast(level.beastAt);

  return {
    render: () => renderer.render(scene, camera),
    step: (dt) => {
      for (const t of turning) {
        if (Math.abs(t.shown - t.target) < 1e-4) {
          t.shown = t.target;
          continue;
        }
        t.shown += (t.target - t.shown) * Math.min(1, (dt * 1000) / (CAMERA.turnMs * 0.35));
        t.group.rotation.y = t.shown;
      }
    },
    setTurns,
    setWater,
    setBeast,
    toScreen: (port) => {
      const place = layout.ports[port];
      const raw: Vec3[] = place
        ? "at" in place
          ? [place.at]
          : [place.from, place.to]
        : [[0, 0, 0]];
      const pivot = place?.part ? layout.pivots[place.part] : undefined;
      const turnNow = turning.find((t) => t.part === place?.part);
      const quarter = turnNow ? Math.round((-turnNow.target * 2) / Math.PI) : 0;
      const pts = pivot
        ? raw.map((p) => turnedAround(p, pivot, (((quarter % 4) + 4) % 4) as Turn))
        : raw;
      let sx = 0;
      let sy = 0;
      for (const p of pts) {
        const [x, y] = project(p, level.opens.camera);
        sx += x / pts.length;
        sy += y / pts.length;
      }
      return {
        x: (sx - midX + half) / (2 * half),
        y: 1 - (sy - midY + half) / (2 * half),
      };
    },
    resize: (w, h) => {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h, false);
    },
    dispose: () => renderer.dispose(),
  };
}

export { BACKGROUND };
