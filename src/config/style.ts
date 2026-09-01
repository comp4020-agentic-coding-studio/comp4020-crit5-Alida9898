// Every value a human eye has to tune, in one place.
//
// Nothing here is logic. The rules never read this file and the rendering
// never hard-codes a number that belongs in it — that separation is what lets
// the look be adjusted without touching anything that can break.

/** Palette. Three tones per hue: lit face, middle face, shadowed face.
 *  Volume comes from which face you are looking at, not from cast shadows. */
export const PALETTE = {
  sandstone: { light: "#E8D5B7", mid: "#D4B896", dark: "#A8906F" },
  ochre: { light: "#E0A94F", mid: "#C08432", dark: "#8A5A1E" },
  lapis: { light: "#4A6FA5", mid: "#2E4A73", dark: "#1B2E4A" },
  date: { light: "#7A9455", mid: "#5C7340", dark: "#3E4F2B" },
} as const;

export const BACKGROUND = "#F2E4CE";

export type Hue = keyof typeof PALETTE;
export type Tone = keyof (typeof PALETTE)["sandstone"];

/** Camera. The pitch never changes; only the azimuth, and only between these
 *  four values. A finite enumeration is what makes a hand-written table per
 *  angle possible at all. */
export const CAMERA = {
  /**
   * 俯角。规格写 30–35,这里取 35.264 —— 也就是 atan(1/√2),真正的等距角。
   *
   * 它是这个区间里**唯一**让整数格点精确重合的值:y 升 1、x 和 z 各升 1 时,
   * 屏幕位置完全不变。补偿比是 √2 / tan(俯角) —— 33° 给 2.178,30° 给 2.449,
   * 都不是整数,于是「隔着一层楼的两条边像素级重合」就永远差一点。
   * 规格自己要求的就是那个精确重合,所以这里跟着几何走。
   */
  pitchDeg: 35.264389682754654,
  /** The only azimuths that exist, in cycling order. */
  azimuthsDeg: [45, 135, 225, 315] as const,
  /** Half-height of the orthographic frustum, in world units. */
  halfHeight: 6.4,
  /** How long a turn takes. Input and every connectivity judgement are
   *  suspended for exactly this long: the in-between angles break the
   *  illusion, and the animation is where that is hidden. */
  turnMs: 620,
  /** Ease-in-out, so the angle is never read mid-flight. */
  ease: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
} as const;

export type Azimuth = (typeof CAMERA.azimuthsDeg)[number];

/** Two lights, and only two. The directional one is fixed in world space — if
 *  it followed the camera, every face would keep its brightness through a turn
 *  and the building would flatten out exactly when the player is looking. */
export const LIGHT = {
  sunDirection: [0.55, 1, 0.35] as const,
  sunIntensity: 1.5,
  /** High enough that a face turned away is still read as stone, not a hole. */
  ambientIntensity: 0.62,
} as const;

export const RENDER = {
  antialias: true,
  toneMappingExposure: 1.1,
  /** A little bloom is allowed; contact shadows are not. */
  bloomStrength: 0.18,
} as const;

/**
 * §3.1:一个 tile = 一个 Three.js 世界单位。**全项目没有第二个换算比。**
 *
 * 下面每一个尺寸都写成 TILE 的倍数或 §3.5 点名的比例,不许出现别的数。
 */
export const TILE = 1;

/** Proportions. A terrace is never one box: body, a lighter top slab, and a
 *  cornice slightly wider than the body and a tone darker.
 *
 *  **这里全是尺寸,没有一个是位置。**§3.1 的原话是「对齐问题靠改几何的原点或
 *  尺寸来修,永远不靠挪位置」,所以亚 tile 的细节一律烘进几何自己的原点
 *  (`geometry.translate`),`mesh.position` 只落在半 tile 的格点上。
 *  `spec/scene-invariants.test.ts` 盯着这条。 */
export const FORM = {
  /** 露台的原点是它的**顶面** —— 也就是兽踩的那个面。摆一块露台时
   *  `position` 就是它顶面的格点,不用再心算厚度。 */
  terraceBody: 0.34 * TILE,
  terraceSlab: 0.08 * TILE,
  /** 檐口比主体每边宽出这么多。§3.5:「略宽于主体」。 */
  corniceOverhang: 0.045 * TILE,
  corniceHeight: 0.1 * TILE,
  /** Steps are built, not ramped: each one has a real riser and tread. */
  stepRise: 0.16 * TILE,
  stepTread: 0.26 * TILE,

  /** §3.5:池子直径 0.8 TILE。渠道从池沿起画而不是从池心起,用的就是这同一个
   *  数 —— 不是另起一个看着顺眼的比例(那正是 0.42 这个坑的成因)。 */
  poolRadius: 0.4 * TILE,
  /** 池沿:一圈开口圆柱当护栏,半径正好半个 tile。
   *
   *  它替掉了池子那块砖的顶板,而不是加在顶板上面 —— 一块铺满整格的实心顶板
   *  会把它底下任何东西盖死,池子就永远看不见。「内嵌」在没有 CSG 的情况下
   *  只能这样做:水面低于池沿,而池沿本身是个圈,中间是空的。 */
  poolWallRadius: 0.5 * TILE,
  poolRim: 0.12 * TILE,
  /** 水面比池沿低这么多 —— 「内嵌,不凸出」量的就是这一段。 */
  poolSink: 0.05 * TILE,
  /** 水往砖里沉多深。只有顶面看得见,但沉进去才不会和砖顶面共面打架。 */
  poolDepth: 0.3 * TILE,

  /** Channels: a masonry trough with water sitting inside it. */
  channelWidth: 0.38 * TILE,
  channelWall: 0.09 * TILE,
  waterInset: 0.06 * TILE,
} as const;

/**
 * 兽。§3.5:占一格,高约一个 TILE。
 *
 * 幼年的穆什胡什:头身比大 —— 那是幼体的特征,也是「可爱」的来源。造型仍是
 * 占位(伊什塔尔门的浮雕留到后面),但尺度是按规格定死的。
 */
export const BEAST = {
  legRadius: 0.06 * TILE,
  legHeight: 0.28 * TILE,
  legSpreadX: 0.18 * TILE,
  legSpreadZ: 0.24 * TILE,
  bodyRadius: 0.34 * TILE,
  bodyY: 0.48 * TILE,
  headRadius: 0.28 * TILE,
  headY: 0.74 * TILE,
  headZ: 0.26 * TILE,
  snoutRadius: 0.14 * TILE,
  snoutY: 0.66 * TILE,
  snoutZ: 0.46 * TILE,
  tailRadius: 0.05 * TILE,
  tailLength: 0.42 * TILE,
  tailY: 0.56 * TILE,
  tailZ: -0.36 * TILE,
  /** 尾巴上翘的角度(弧度)。 */
  tailTilt: -0.7,
  /** 走路时上下起伏的幅度。 */
  bob: 0.03 * TILE,
} as const;
