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
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import type { Side } from "three";
import { ACESFilmicToneMapping } from "three";
import { BACKGROUND, BEAST, CAMERA, FORM, LIGHT, PALETTE, RENDER, TILE } from "./config/style.ts";
import type { Azimuth } from "./config/style.ts";
import type { Layout, Placement, Vec3 } from "./iso.ts";
import { frameFraction, project, turnedAround } from "./iso.ts";
import type { Level, PartId, PortId, Turn } from "./rules.ts";

/** 相机沿对角线退多远。正交投影下不影响画面,只要越过近裁面。 */
const D = 60;

const lambert = (colour: string, side?: Side): MeshLambertMaterial =>
  new MeshLambertMaterial({ color: colour, side: side ?? FrontSide });

/**
 * 一块露台。**原点是它的顶面** —— 也就是兽踩的那个面。
 *
 * 三件 primitive,一件不多:主体、顶板(亮一档)、檐口(略宽,暗一档)。
 * 单个 box 在固定光下会读成一张纸,§3.5 明令不许;反过来,凭空多加的装饰
 * (砖缝、藏青描边、角柱)也不许 —— 「没有关卡数据之外的几何」。
 *
 * 每一件的 `position` 都是 (0,0,0):高低差全烘进几何自己的原点。§3.1 的原话
 * 是「对齐问题靠改几何的原点或尺寸来修,永远不靠挪位置」。
 *
 * `deck = true` 时顶板换成一圈开口圆柱护栏 —— 池子那块砖用这个。一块铺满整格
 * 的实心顶板会把它底下任何东西盖死,池子就永远看不见;护栏中间是空的,水面
 * 低于它,「内嵌」才成立。
 */
function terrace(
  hue: keyof typeof PALETTE = "sandstone",
  deck = false,
  toGround = 0,
): Group {
  const g = new Group();
  const tone = PALETTE[hue];

  // 顶面在 y=0,所以每一层都往下长。
  const topDepth = deck ? 0 : FORM.terraceSlab;

  // 主体一直挤到地面。柱廊拆掉之后,y=1 那几块露台底下就什么都没有了 ——
  // 它们飘在空中,而 §3.5 的原话是「侧面是主体的实心挤出」。参考图里的阶梯塔
  // 也是一路砌到地的实心体,没有一根柱子。
  //
  // `toGround` 是顶面离地多高,由摆放的 y 推出来 —— 那是**尺寸**,不是位置,
  // §3.1 允许(「对齐靠改几何的尺寸或原点,不靠挪位置」)。给 0 就退回原来那个
  // 固定厚度,免得没有 y 的调用点算出负长度。
  const bodyHeight = Math.max(FORM.terraceBody, toGround - topDepth - FORM.corniceHeight);

  if (deck) {
    // 池沿。开口圆柱是一片没有厚度的墙,所以要 DoubleSide —— 否则远侧那半圈
    // 的正面朝外,从这个角度看过去被剔掉,池子会缺半边沿。
    // 这不是绘制顺序的手脚(§3.4 禁的是那个),只是一面墙有两个面。
    const rim = new Mesh(
      new CylinderGeometry(
        FORM.poolWallRadius,
        FORM.poolWallRadius,
        FORM.poolRim,
        24,
        1,
        true,
      ).translate(0, FORM.poolRim / 2, 0),
      lambert(tone.light, DoubleSide),
    );
    g.add(rim);
  } else {
    const slab = new Mesh(
      new BoxGeometry(TILE, FORM.terraceSlab, TILE).translate(0, -FORM.terraceSlab / 2, 0),
      lambert(tone.light),
    );
    g.add(slab);
  }

  const body = new Mesh(
    new BoxGeometry(TILE, bodyHeight, TILE).translate(0, -topDepth - bodyHeight / 2, 0),
    lambert(tone.mid),
  );
  g.add(body);

  const cornice = new Mesh(
    new BoxGeometry(
      TILE + FORM.corniceOverhang * 2,
      FORM.corniceHeight,
      TILE + FORM.corniceOverhang * 2,
    ).translate(0, -topDepth - bodyHeight - FORM.corniceHeight / 2, 0),
    lambert(tone.dark),
  );
  g.add(cornice);

  return g;
}

/**
 * 一个池子:**一件几何,就一件。**§3.5「Pool: 1 tile; an inset cylinder,
 * diameter 0.8 TILE」。
 *
 * 顶面落在池沿之下 —— 那是「内嵌,不凸出」的全部含义。往砖里再沉一段,是为了
 * 不和砖的顶面共面:两个共面的面会 z-fighting,而修它的正道是把几何挪开,
 * 不是去动深度测试。
 */
function pool(): Mesh {
  const height = FORM.poolDepth + FORM.poolRim - FORM.poolSink;
  return new Mesh(
    new CylinderGeometry(FORM.poolRadius, FORM.poolRadius, height, 24).translate(
      0,
      FORM.poolRim - FORM.poolSink - height / 2,
      0,
    ),
    lambert(PALETTE.lapis.mid),
  );
}

/**
 * 终点大池的上层:一根柱子托起一只浅盆,盆里一层水。
 *
 * 为什么只有大池有:§3.5 的几何词汇表里池子就是「1 格、内嵌的圆柱」,而喷泉
 * 是往上长的 —— 两者直接冲突。所以这个形只给**终点**那一口,它在规格 §5 里
 * 本来就有个专名(塔顶的大蓄水池),需要一个和沿途池子一眼分得开的形。
 *
 * 颜色是 `sandstone.light` —— §3.7 三档里唯一的米白,不是自选的颜色。它底下
 * 那块砖仍然是赭金:没有 HUD 也没有文字,玩家一眼认出目标靠的是那团金色,
 * 把整个终点刷成米白等于把那个信号删掉。金座上的一件米白器物,两个都留住。
 *
 * 下层(砖里那口内嵌的池子)一点没动 —— 「水面低于池沿」那条不变量量的是它,
 * 柱和盆长在它上面,不参与那条判定。
 */
function fountainTop(): { group: Group; water: Mesh } {
  const g = new Group();
  const tone = PALETTE.sandstone;

  const stem = new Mesh(
    new CylinderGeometry(
      FORM.fountainStemRadius,
      FORM.fountainStemRadius,
      FORM.fountainStemHeight,
      16,
    ).translate(0, FORM.fountainStemHeight / 2, 0),
    lambert(tone.mid),
  );
  g.add(stem);

  // 盆是**一圈开口的墙**,不是一个实心圆柱 —— 和池沿同一个办法,而且是同一个
  // 理由:没有 CSG,实心的盆装不下水,水只能被盖死在里面。第一版就是实心的,
  // 盆顶和水面共面,z-fighting 在盆里打出一个风车花纹。
  // DoubleSide 是因为一片没有厚度的墙,远侧那半圈的正面朝外会被剔掉。
  const bowlY = FORM.fountainStemHeight;
  const bowl = new Mesh(
    new CylinderGeometry(
      FORM.fountainBowlRadius,
      FORM.fountainBowlRadius,
      FORM.fountainBowlHeight,
      24,
      1,
      true,
    ).translate(0, bowlY + FORM.fountainBowlHeight / 2, 0),
    lambert(tone.light, DoubleSide),
  );
  g.add(bowl);

  // 盆里的水:水面比盆沿低 `poolSink`,和下层那口池子**同一个**常数 ——
  // 「内嵌」就是水面低于沿口,两层说的是同一句话。水的下缘仍然在盆底之上,
  // 所以从 35° 看过去不会从盆底下露出来。
  const waterTop = bowlY + FORM.fountainBowlHeight - FORM.poolSink;
  const water = new Mesh(
    new CylinderGeometry(
      FORM.fountainBowlRadius - FORM.waterInset,
      FORM.fountainBowlRadius - FORM.waterInset,
      FORM.fountainBowlWater,
      24,
    ).translate(0, waterTop - FORM.fountainBowlWater / 2, 0),
    lambert(PALETTE.lapis.mid),
  );
  g.add(water);

  return { group: g, water };
}

/** 一段砖砌水渠:两道侧壁夹着一条水。水是独立的物体,不是把渠染蓝 —— 后者
 *  会让水淹掉砖,读起来就不再是「某个东西里面的水」。 */
/**
 * 一段砖砌水渠。
 *
 * 逻辑锚点是两端的**中心点**(对齐判定用的就是它),但画出来的渠要从池沿起、
 * 到**另一头的池沿**止 —— 两头都收,不是只收一头。只收上游那头时,下游端面
 * 正落在对面池心上,于是渠整条戳进大池、盖住它一半水面,读起来是两个物件穿模,
 * 不是水利工程。两头各收一个池半径,渠的端面就和两边的水面正好相切:挨着,
 * 不重叠。
 */
function channel(from: Vec3, to: Vec3): { group: Group; water: Mesh; half: Mesh } {
  const g = new Group();
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const full = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  // 整条渠在**本地**坐标里造,原点是两端的中点,+z 是水流方向。两端都是整数
  // 格点,所以中点必然落在半 tile 的格点上 —— 那是 group 唯一带位置的地方,
  // 里面每一件 mesh 的 position 都是 (0,0,0)。
  g.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);

  // 两端各收一个池半径 —— 收进去的量就是池子自己的半径(同一个常数也用来画
  // 池子本体),不是另起一个看着顺眼的比例。span 太短时封顶在半程,防止几何
  // 长度变负,这是数学上的安全边界,不是手调的观感数字。
  const inset = Math.min(FORM.poolRadius, full / 2);
  const span = full - inset * 2;
  // 两头收得一样多,所以槽的中心就是两端的中点,也就是 group 的原点。

  // 整条渠沉到池沿之下。「渠在池子底下」这件事只能是几何上真的更低 ——
  // §3.4 不许 renderOrder、不许关深度测试,前后一律由深度缓冲说了算。
  // 沉多少写在 style.ts 里,而且和池沿是同一个常数。
  const drop = FORM.channelDrop;

  /** 造一件渠上的零件:先按 +z 铺好、烘进原点,再整体转到渠的方向。 */
  const piece = (w: number, h: number, len: number, y: number, z: number, colour: string): Mesh =>
    new Mesh(
      new BoxGeometry(w, h, len).translate(0, y - drop, z).rotateY(angle),
      lambert(colour),
    );

  // 空渠必须看得出是「一条潜在的路,只是现在是空的」:两道立起来的边墙夹着
  // 一条凹下去的槽底。没有这个轮廓,断口那头就只是一片虚空,玩家不会想到
  // 「这里本来能过」—— 这个形状替代了文字教程。
  g.add(piece(FORM.channelWidth, FORM.channelWall * 0.7, span, -FORM.channelWall * 0.5, 0, PALETTE.lapis.dark));

  for (const side of [-1, 1]) {
    // 边墙沿渠的法线让开半个渠宽。这里是**几何自己的原点**,不是位置微调 ——
    // 转 y 轴之前 +x 就是法线方向。
    const wall = new Mesh(
      new BoxGeometry(FORM.channelWall, FORM.channelWall * 2.1, span)
        .translate((side * FORM.channelWidth) / 2, FORM.channelWall * 0.25 - drop, 0)
        .rotateY(angle),
      lambert(PALETTE.sandstone.mid),
    );
    g.add(wall);
  }

  // 灌满的水:整条。
  const water = piece(
    FORM.channelWidth - FORM.waterInset * 2,
    FORM.channelWall,
    span,
    FORM.channelWall * 0.5,
    0,
    PALETTE.lapis.mid,
  );
  water.visible = false;
  g.add(water);

  // 半满的水:只有靠源那半截,末端明明白白悬空。规格要求这是可见状态。
  const halfLen = span * 0.55;
  const half = piece(
    FORM.channelWidth - FORM.waterInset * 2,
    FORM.channelWall,
    halfLen,
    FORM.channelWall * 0.5,
    // 靠源那一端:从槽的起点往前铺半截。
    -span / 2 + halfLen / 2,
    PALETTE.lapis.mid,
  );
  half.visible = false;
  g.add(half);

  return { group: g, water, half };
}

/** 一块正在转、或者将要转的砖。 */
export type Turning = { group: Group; part: PartId; shown: number; target: number };

/** 建好的世界。`createStage` 拿它去渲染,传感器拿它去量。 */
export type BuiltWorld = {
  /** 场景图的根。已经把建筑的几何中心挪到了原点。 */
  world: Group;
  turning: Turning[];
  pieces: Map<PortId, Group>;
  waters: Map<PortId, { full: Mesh; half: Mesh }>;
  poolWater: Map<PortId, Mesh>;
  /** 喷泉上层盆里那层水。和 `poolWater` 分开放,是因为那条「水面低于池沿」的
   *  不变量量的是砖里那口池子;上层长在它**上面**,混进同一个 map 会让不变量
   *  变成「量喷泉的最高点」,当场自相矛盾。 */
  grandWater: Map<PortId, Mesh>;
  beast: Group;
};

/**
 * 把一关的数据摆成场景图。**不碰 renderer,不碰相机。**
 *
 * 分出来是因为 `spec/scene-invariants.test.ts` 要在 jsdom 里量这些几何,
 * 而 jsdom 里 `new WebGLRenderer()` 起不来。传感器量的必须是真正画出去的那份
 * 场景图,不是另写一份「应该是这样」—— 后者只会两边一起漂。
 */
export function buildWorld(level: Level, layout: Layout): BuiltWorld {
  const world = new Group();

  // 把建筑的几何中心挪到原点。相机是绕原点转的,建筑要是偏在一边,转四分之一
  // 圈就甩出画外 —— 而这不是取景没框够,是转轴不对。
  {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    for (const place of Object.values(layout.ports)) {
      const raw: Vec3[] = "at" in place ? [place.at] : [place.from, place.to];
      for (const p of raw) {
        sx += p[0];
        sy += p[1];
        sz += p[2];
        n++;
      }
    }
    if (n > 0) world.position.set(-sx / n, -sy / n, -sz / n);
  }

  const turning: Turning[] = [];
  const pieces = new Map<PortId, Group>();
  const waters = new Map<PortId, { full: Mesh; half: Mesh }>();
  const poolWater = new Map<PortId, Mesh>();
  const grandWater = new Map<PortId, Mesh>();

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

  // 哪块砖是池子的底,由数据说了算(`pool.on`),不靠比坐标猜。
  const deckOf = new Map<PortId, (typeof level.pools)[number]>();
  for (const p of level.pools) if (p.on) deckOf.set(p.on, p);

  for (const platform of level.platforms) {
    const place = layout.ports[platform.id];
    if (!place || !("at" in place)) continue;
    const host = deckOf.get(platform.id);
    // 终点大池那块砖用赭金 —— 没有 HUD 也没有文字,玩家一眼认出目标全靠它。
    // 顶面离地多高 = 它摆在第几层。这块砖因此一路砌到地面,不再飘着。
    const g = terrace(host?.grand ? "ochre" : "sandstone", host !== undefined, place.at[1] * TILE);
    g.position.set(...place.at);
    mount(g, place);
    pieces.set(platform.id, g);
  }

  for (const p of level.pools) {
    const place = layout.ports[p.id];
    if (!place || !("at" in place)) continue;
    const g = new Group();
    const w = pool();
    w.visible = !p.isFinal;
    g.add(w);
    poolWater.set(p.id, w);
    if (p.grand) {
      const top = fountainTop();
      top.water.visible = w.visible;
      grandWater.set(p.id, top.water);
      g.add(top.group);
    }
    g.position.set(...place.at);
    mount(g, place);
    pieces.set(p.id, g);
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
  // 幼年的穆什胡什:头大身子短 —— 头身比大是幼体的特征,也是「可爱」的来源。
  // 造型仍是占位,但尺度是 §3.5 定死的:占一格,高约一个 TILE。
  // 每一件的 position 都是 (0,0,0),姿势全烘进几何的原点。
  const beast = new Group();
  {
    const body = new Mesh(
      new SphereGeometry(BEAST.bodyRadius, 12, 10)
        .scale(1, 0.9, 1.25)
        .translate(0, BEAST.bodyY, 0),
      lambert(PALETTE.ochre.mid),
    );
    beast.add(body);

    const head = new Mesh(
      new SphereGeometry(BEAST.headRadius, 12, 10).translate(0, BEAST.headY, BEAST.headZ),
      lambert(PALETTE.ochre.light),
    );
    beast.add(head);

    // 蛇头的吻部,压扁一点点。
    const snout = new Mesh(
      new SphereGeometry(BEAST.snoutRadius, 8, 8)
        .scale(0.8, 0.7, 1.4)
        .translate(0, BEAST.snoutY, BEAST.snoutZ),
      lambert(PALETTE.ochre.light),
    );
    beast.add(snout);

    // 蝎尾:向上翘,幼体的尾巴短。
    const tail = new Mesh(
      new CylinderGeometry(BEAST.tailRadius, BEAST.tailRadius * 2, BEAST.tailLength, 6)
        .rotateX(BEAST.tailTilt)
        .translate(0, BEAST.tailY, BEAST.tailZ),
      lambert(PALETTE.ochre.dark),
    );
    beast.add(tail);

    // 四条短腿。
    for (const [lx, lz] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const leg = new Mesh(
        new CylinderGeometry(BEAST.legRadius, BEAST.legRadius * 0.9, BEAST.legHeight, 6).translate(
          lx * BEAST.legSpreadX,
          BEAST.legHeight / 2,
          lz * BEAST.legSpreadZ,
        ),
        lambert(PALETTE.ochre.dark),
      );
      beast.add(leg);
    }
  }
  world.add(beast);

  return { world, turning, pieces, waters, poolWater, grandWater, beast };
}

export type Stage = {
  render: () => void;
  step: (dt: number) => void;
  /** 把砖块摆到某个配置。转动是动画,期间外部应当封锁输入。 */
  setTurns: (turns: Record<PartId, Turn>) => void;
  /** 把相机转到某个枚举角度。同样是动画,期间不得做任何连通判定。 */
  setCamera: (azimuth: Azimuth) => void;
  /** 相机是不是正在转。转的过程中每一帧都在穿帮,不能拿来判定或拾取。 */
  turning: () => boolean;
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

  const { world, turning, waters, poolWater, grandWater, beast } = buildWorld(level, layout);
  scene.add(world);

  // 取景:把所有 port 在所有配置下的投影都框进来,免得转到某一档就跑出画外。
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  // 相机会转,所以取景要把**每一个角度**下的投影都框进去 —— 只按开局角度框,
  // 转过去就有东西跑出画外。
  const note = (raw0: Vec3): void => {
    const p: Vec3 = [
      raw0[0] + world.position.x,
      raw0[1] + world.position.y,
      raw0[2] + world.position.z,
    ];
    for (const az of CAMERA.azimuthsDeg) {
      const [x, y] = project(p, az);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  };
  for (const place of Object.values(layout.ports)) {
    const raw: Vec3[] = "at" in place ? [place.at] : [place.from, place.to];
    for (const p of raw) {
      note(p);
      const pivot = place.part ? layout.pivots[place.part] : undefined;
      if (pivot) for (const t of [1, 2, 3] as Turn[]) note(turnedAround(p, pivot, t));
    }
  }
  const pad = CAMERA.framePad;
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
  let azWant = level.opens.camera as number;
  let azShown = azWant;

  function placeCamera(): void {
    const az = (azShown * Math.PI) / 180;
    const pitch = (CAMERA.pitchDeg * Math.PI) / 180;
    camera.position.set(
      D * Math.cos(pitch) * Math.cos(az),
      D * Math.sin(pitch),
      D * Math.cos(pitch) * Math.sin(az),
    );
    camera.lookAt(0, 0, 0);
  }
  placeCamera();
  camera.updateProjectionMatrix();

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
      // 上层盆跟着下层一起亮:一口喷泉不会只有一层有水。
      const top = grandWater.get(id);
      if (top) top.visible = w.visible;
    }
  }

  let beastWant: Vec3 | null = null;
  let beastShown: Vec3 | null = null;

  function setBeast(port: PortId): void {
    const place = layout.ports[port];
    if (!place || !("at" in place)) return;
    // 露台的原点**就是**它的顶面,所以兽踩的高度就是 port 的 y —— 不用再
    // 心算厚度。这一行以前是 `+ terraceBody/2 + terraceSlab`,那是旧原点的
    // 遗物,厚度一改就悄悄错位。
    beastWant = [place.at[0], place.at[1], place.at[2]];
    if (!beastShown) {
      beastShown = [...beastWant];
      beast.position.set(...beastShown);
    }
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
      // 兽走过去,不是瞬移。这一段位移就是「你点的那一下起作用了」的反馈,
      // 而这一关没有任何文字或 HUD 来说这件事。
      if (beastWant && beastShown) {
        const k = Math.min(1, dt * 7);
        let moving = false;
        for (let i = 0; i < 3; i++) {
          const d = beastWant[i] - beastShown[i];
          if (Math.abs(d) > 0.001) moving = true;
          beastShown[i] += d * k;
        }
        if (moving) {
          // 走的时候微微起伏,像迈步。
          const bob = Math.sin(performance.now() / 90) * BEAST.bob;
          beast.position.set(beastShown[0], beastShown[1] + bob, beastShown[2]);
        } else {
          beast.position.set(...beastShown);
        }
      }
      if (Math.abs(azShown - azWant) > 0.01) {
        // 走最短的一边转过去。中间的每一个角度都必然穿帮 —— 那正是这段动画
        // 存在的意义:把穿帮藏进去。
        let delta = azWant - azShown;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        const k = Math.min(1, (dt * 1000) / (CAMERA.turnMs * 0.4));
        azShown += delta * k;
        if (Math.abs(azWant - azShown) < 0.05) azShown = azWant;
        placeCamera();
      }
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
    setCamera: (az) => {
      azWant = az;
    },
    turning: () => Math.abs(azShown - azWant) > 0.01,
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
      // 吸附到最近的**枚举角度**,不是最近的 90 的倍数 —— 方位角是
      // 45/135/225/315,一个都不是 90 的倍数,Math.round(135/90)*90 会给出
      // 180,于是按钮一直落在错的地方。
      const az = CAMERA.azimuthsDeg.reduce((best, a) =>
        Math.abs(a - azShown) < Math.abs(best - azShown) ? a : best,
      );
      for (const p0 of pts) {
        const p: Vec3 = [
          p0[0] + world.position.x,
          p0[1] + world.position.y,
          p0[2] + world.position.z,
        ];
        const [x, y] = project(p, az);
        sx += x / pts.length;
        sy += y / pts.length;
      }
      // 换算用相机**当前的**视锥边界,不用建相机时那个 half。
      //
      // 这里一度写的是 `(sx - midX + half) / (2 * half)` —— 那等于把视锥当成
      // 永远是正方形。视锥改成按宽高比撑长边的那一刻,16:9 下横向就差了 1.78 倍,
      // 按钮整排被推到画面外:点不到兽不走,连点击涟漪都不出现,而画面本身
      // 一切正常。§3.3 的原话是「覆盖层定位只能把世界坐标穿过相机投影」,
      // 手算一遍 NDC 就是这条禁令要防的东西。
      return frameFraction(sx, sy, camera);
    },
    resize: (w, h) => {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      // 视锥按宽高比撑**长边**,短边永远是那个刚好框住整座塔的 half。
      // 反过来(两边都用 half)在非正方画布上就是拉伸 —— 而拉伸会让等距角
      // 不再是等距角,整个「整数格点精确重合」的前提当场作废。
      const aspect = w / h || 1;
      const halfW = half * Math.max(1, aspect);
      const halfH = half * Math.max(1, 1 / aspect);
      camera.left = midX - halfW;
      camera.right = midX + halfW;
      camera.top = midY + halfH;
      camera.bottom = midY - halfH;
      camera.updateProjectionMatrix();
    },
    dispose: () => renderer.dispose(),
  };
}

export { BACKGROUND };
