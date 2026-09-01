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

/** Proportions. A terrace is never one box: body, a lighter top slab, and a
 *  cornice slightly wider than the body and a tone darker. */
export const FORM = {
  terraceSize: 1.0,
  terraceBody: 0.34,
  terraceSlab: 0.08,
  corniceOverhang: 0.09,
  corniceHeight: 0.1,
  /** Steps are built, not ramped: each one has a real riser and tread. */
  stepRise: 0.16,
  stepTread: 0.26,
  /** Columns are segmented rather than one tube of constant width. */
  columnSegments: 3,
  columnRadius: 0.09,
  /** 柱子长度是固定的,不跟着露台的世界高度走 —— 后者会让上层露台长出一根
   *  穿出画面的钉子。柱子的作用是「这块是架空的」,不是量高度。 */
  pierLength: 1.15,
  /** Channels: a masonry trough with water sitting inside it. */
  channelWidth: 0.38,
  channelWall: 0.09,
  waterInset: 0.06,
} as const;
