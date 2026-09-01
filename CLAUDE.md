# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state --- with one exception, and only one: a spec test
  written before the thing it tests, which is red *because the work hasn't
  happened yet*. Those are the week's contract, they land in the first commit,
  and turning each one green is the process evidence `PROCESS.md` cites. A test
  that went red because something broke is never in this category. If you can't
  say in one sentence why a red test is the planned starting state, it isn't.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you
ship. CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

Two sensors carried forward from A1, because the template roster has neither:
`check` also runs `oxlint` and `stylelint`, and `spec/accessibility.test.ts` runs
axe-core in jsdom. Read the sections below for what each of them cannot see.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind. `spec/README.md` draws the line.

So as you learn what your prototype needs --- a convention the work has to hold
to, a sensor that keeps catching you out (a linter, say), a fact about the stack
that is easy to get wrong --- write it down here and wire it into `check`.
Growing this file is the work.

## Plan before building, when the ask is more than one thing

Phase 1 of the hunt was built as a complete, working mechanic --- you moved your
aim until two readings cancelled out --- reviewed, and then thrown away whole.
The scoping plan existed and was good (`PLAN.md`, cut the explainer down to ear
asymmetry alone). What was missing was a plan for the *interaction*, so the first
design that got imagined was the first design that got built, and the question
underneath it --- how does the page show that the owl works the height out in
advance? --- never got asked until there was working code to argue with.

So: when a request is more than one task, or when the shape of the thing is not
obvious yet, write the plan first and get it agreed before building. `PLAN.md`
for anything that outlives the session; a short numbered list in the conversation
for anything smaller. A plan is cheap to disagree with. A finished mechanic is
expensive, because disagreeing with it means someone has to accept the work was
wasted --- which is pressure to keep a bad design rather than admit it.

## Commit as each piece of work finishes, not at the end of a session

Crit 1 nearly shipped with nothing real behind it: a whole Windows 98 re-skin
was built, checked with `pnpm check`, and confirmed in the browser across many
turns of back-and-forth --- but never once committed. Because the last real
commit predated all of it, `git status -sb` showed the local branch level with
`origin/main`, which reads as "everything's pushed" even though what was
pushed was a bare stub. A tutor's automated nudge is what caught it, not a
local check.

So: after any turn that leaves the working tree passing `pnpm check` with a
real, reviewed change in it, commit before moving to the next request --- don't
wait for a natural stopping point, because "the session's about to end" isn't
a signal available until the deadline is already close. Before treating a
session as wrapped, run `git status -sb` and `git log --oneline @{upstream}..HEAD`
and confirm there's nothing sitting uncommitted, not just that the working
tree is clean.

## Looking at the page: agent-browser

The rendered page is the ground truth, and this project has no browser on the
PATH. `agent-browser` is not installed globally --- run it through pnpm:

```sh
ab() { pnpm dlx agent-browser@0.34.0 "$@"; }   # zsh: a function, NOT a variable
ab open http://localhost:5173/                # 5173, not the 5177 of an older
                                              # repo: no `server` block here
ab set viewport 1920 1080     # `viewport` lives under `set`, not at top level
ab reload && ab screenshot /tmp/desktop.png
ab set viewport 390 844 && ab reload && ab screenshot /tmp/phone.png
ab a11y                       # axe-core in real Chrome
ab errors                     # page errors
ab close --all
```

Three things that cost time the first run:

- **zsh does not word-split unquoted parameters.** `AB="pnpm dlx ..."` then
  `$AB open` fails with `command not found` because the whole string is treated
  as one command name. Use a shell function.
- **`viewport` is a subcommand of `set`**, so bare `agent-browser viewport ...`
  answers `Unknown command`. Same for `device` and `media`.
- **`set viewport` needs a `reload`** before the screenshot, or you photograph
  the old layout.
- **`ab click <selector>` has silently done nothing** where
  `ab eval "document.querySelector('…').click()"` worked. A no-op click looks
  exactly like a page that ignored the click, so it is worth reaching for `eval`
  before concluding the page is broken --- prefer it when a click is load-bearing
  evidence.

Two checks only a real browser can do, so they do not belong in `pnpm check`:

- **Colour contrast, and the widening list of things axe cannot see.**
  `spec/accessibility.test.ts` runs axe in jsdom, which has no layout, so every
  geometric rule is skipped --- contrast included. `ab a11y` runs the same axe
  in Chrome and does evaluate it, but only for what it can resolve, and three
  things in a row have fallen outside that:
  - **SVG `<text>`** axe cannot measure at all, reporting *incomplete*. A
    hand-check goes stale the moment the background moves, which is how amber
    labels ended up on a cream plate at 1.77:1 after being measured at 8.6:1 on
    the dark. Where the geometry allows it, make the rule positional instead ---
    in A1, `spec/pages.test.ts` forbade a label inside a plate's rect.
  - **A gradient background** returns *incomplete* for every text node over it,
    because axe cannot resolve one background colour behind them. Measure by
    hand against the *lightest* point (worst case for pale text) and write the
    ratio into the CSS beside the value.
  - **A `<canvas>` is opaque to axe** --- there are no nodes inside it, so a
    WebGL or 2D scene is not partially covered, it is entirely uncovered. Nothing
    automatic says anything about it, in jsdom or in Chrome. If the prototype's
    whole point lives on a canvas, then *all* of its contrast is a hand-check,
    and the only durable version of that is to drive the palette from named
    constants in one module and measure those once. Colours picked inline at
    each call site cannot be audited at all.

  Every one of these expires silently when the palette moves, so write the
  measured ratio next to the constant, not in a commit message.
- **Both marking viewports.** 1920x1080 and 390x844 each count in full. Check
  that the core interaction is reachable without a scroll at 1080 --- a page
  whose interaction is below the fold has buried its own point.

## Navigation: collapse it on a phone, and make the collapse survive no JS

More than two or three destinations in a horizontal nav, collapse them behind a
button below the phone breakpoint. In A1 a three-link nav fitted on one line at
390px --- 358px of 390 --- so nothing *looked* broken; it was still spending a
whole row of vertical space on the viewport with the least of it, directly above
the fold, on the page whose interaction has to be reachable without scrolling.
Two traps, both of which look completely finished while broken:

- **Ship the button with `hidden` and let the script remove it.** A hamburger
  that assumes its script ran leaves a button that opens nothing when it did
  not --- and that failure is invisible, because a dead button looks like a live
  one. The plain list is the correct no-script state.
- **Restore the list unconditionally above the breakpoint.** A phone left closed
  and then rotated past the breakpoint otherwise has no nav at all: the collapsed
  state is stale and nothing on screen says so. This is found by users, not by
  you, because you never rotate your own test device mid-session.

In A1 both were pinned in `spec/nav.test.ts` and `spec/pages.test.ts`.
`spec/invariants.test.ts` requires a `<nav>` landmark on every page, so even a
single-screen prototype carries one --- while it stays a single link this
section costs nothing, and the moment it grows past that, pin them again rather
than trusting the memory.

## A gesture's direction is untestable where it usually lives

C4's pour gesture sent the water *up* when the hand went *down*. Both directions
animate smoothly, neither errors, and the suite was green through the whole
thing --- it was found by a person dragging a glass and saying "why does this go
the wrong way". The sum was one line inside a `pointermove` handler, which is a
place a unit test cannot reach: importing the module needs a DOM, an
`AudioContext` and synthetic `PointerEvent`s before it can assert anything.

So: when a gesture maps input to state, put the arithmetic in a pure function
and call it from the handler. `pouredLevel(startLevel, dy, travel)` in
`tuning.ts` exists for no reason except that its direction can then be two lines
in `spec/tuning.test.ts`. Applies to anything with a sign in it --- scroll,
drag, zoom, scrub.

## The game: Hanging Gardens (this brief only — retires with it)

The specification below is the author's, kept in their own words because it is
the contract and a translation would blur it. What carries forward from this
section is not the rules but the move underneath them: a constraint written
down and wired to a check beats a constraint remembered.

古巴比伦空中花园主题的视错觉解谜游戏。玩家旋转**相机**,利用等距投影下的
视觉重合,重组水路与步行路径,让幼发拉底河的水层层向上,最终填满顶层的大蓄水池。

引水兽(穆什胡什)是唯一的角色。它不战斗、不跳跃,只走路和站立。

### 一、五条核心规则

这五条是整个游戏的全部规则,不可增加,不可设例外。

1. **屏幕上看起来连着,就是连着。** 所有连通判定——水路和步行路径——都基于
   当前相机角度下的视觉连接,与三维中的真实距离无关。没有例外。
2. **水只向屏幕上看起来更低的方向流。**
3. **引水兽站在取水点上,水才开始流。** 兽离开取水点,已经发生的结果不回退。
4. **一段水渠的两端都锚在蓄水池上,该段才算灌满。灌满不可逆。**
   只流到一半、末端没有接到池子的水渠,保持半满状态,不可行走。
5. **灌满的水渠是可行走的路面,但它仍然遵守第 1 条。**
   已灌满的水渠在某些相机角度下看起来是断开的,那个角度下就走不过去。
   「满」是水的状态,「通」是视觉的状态,两者互不影响。

由规则推出的设计后果(实现时必须保持):

- 水的对齐要求(渠的两端锚到池子)和步行的对齐要求(渠看起来接着兽脚下的地面)
  是**同一段几何上的两个不同判定**。同一个相机角度可能满足其一而不满足另一。
  谜题的深度来自这里,不要试图统一它们。
- 「水流到一半停住」是一个**合法且重要的可见失败状态**,必须在画面上明确表现
  (水停在渠中,末端悬空),不是 bug,不要加逻辑去阻止它发生。

### 二、架构约束(不可协商)

连通性来自手写的表,不来自几何计算:

- **当前版本:相机固定在一个角度,玩家转的是砖块。** 规格原本写的是转相机,
  那条留在下面没删 —— 数据结构两者通吃,见 `when`。改回去只需给声明多填一项,
  规则和传感器都不动。
- 一次「配置」= 相机角度 + 每块砖转到第几档。**都是有限枚举**,不是连续值。
- 每条连通声明带一个 `when`,写明它在哪个配置下成立;省略的项表示「不关心」。
  这样避免了「每种组合手写一整份表」的组合爆炸,而每一条仍然是手写的。
- 运行时只查表。
- **禁止**射线检测(Raycaster)、屏幕空间投影、包围盒重叠检测,或任何用几何
  运算推导「两个东西看起来是否对齐」的做法。
- 视觉上的对齐由模型摆放位置保证,由表格声明,**不由代码推断**。
- 关卡数据是手写字面量,放在 `src/levels/` 下,一关一个文件。不生成、不派生。

这条是本项目最重要的架构决定。如果发现自己在写「计算两个平台投影后是否重叠」
之类的代码,说明方向错了,停下来。

```ts
type PortId = string;   // 池子、渠端、平台边缘等一切可连接点的名字
type PartId = string;   // 可转的砖块
type Turn = 0 | 1 | 2 | 3;

/** 一条声明在什么配置下成立。省略 = 不关心。 */
type When = { camera?: Azimuth; turns?: Partial<Record<PartId, Turn>> };
type Link = { between: [PortId, PortId]; when: When };

interface Level {
  pools: { id: PortId; isSource?: boolean; isFinal?: boolean }[];
  channels: { id: PortId; ends: [PortId, PortId] }[];   // ends 指向两个池子
  platforms: { id: PortId }[];
  tapPoints: { id: PortId; on: PortId }[];              // 取水点,及其所在平台
  parts: PartId[];                                      // 可转的砖块

  waterLinks: Link[];   // 看起来水路相连
  walkLinks: Link[];    // 看起来可以走过去
}
```

`waterLinks` 与 `walkLinks` 必须分开声明,不要合并。它们是两套独立的判定。
`walkLinks` 中可以引用 `channels` 的 id;该条连接只在对应水渠已灌满时生效。
运行时状态只有两项:当前相机角度、已灌满的水渠集合(只增不减)。

### 三、渲染约束

相机:

- Three.js,相机必须是 `OrthographicCamera`。**禁止 `PerspectiveCamera`。**
  透视会让远处的边永远无法精确对齐,视错觉的前提就是屏幕上两条边像素级重合。
- **禁止 `OrbitControls` 或任何自由轨道相机。**
- **当前版本相机固定;转的是砖块。** 下面这两条对砖块一字不差地适用,
  将来相机转起来时也照用:
- 一次转动 = 播放一段固定的过渡动画,落到下一个枚举档位。
  **过渡动画期间不接受输入,不进行任何连通判定。**
  中间状态必然穿帮,穿帮必须藏在动画里。
- 相机俯角由 `style.ts` 常量控制,取 35.264°(atan(1/√2))。规格写 30–35,
  而这是区间里**唯一**让整数格点精确重合的值:补偿比 √2/tan(俯角) 在这里等于
  2,33° 给 2.178,30° 给 2.449 —— 都会让两条边永远差一点点,正是规格排除
  透视相机时要避免的那种差一点。

几何:

- 所有几何体由 Three.js 内置 primitive 构成。
  **禁止导入外部 3D 模型(.glb/.gltf/.obj 等)、禁止贴图文件。** 一切画面由代码生成。
- 每块露台由至少三个 primitive 构成:主体、顶面薄板(亮一档)、
  底部檐口(比主体略宽,暗一档)。不要用单个 box 表示一块露台。
- 台阶要有可见厚度,不要用斜面代替。柱子分段,不要单根等宽圆柱。

材质与光照:

- 材质用 `MeshLambertMaterial`。**禁止** `MeshStandardMaterial`、
  `MeshPhysicalMaterial`、PBR、法线贴图、环境光遮蔽、`shadowMap`。
- **不要用 `MeshBasicMaterial`。** 它不受光,立方体三个面颜色完全一样,
  体积感会彻底消失。
- 光照只有两盏:一盏 `DirectionalLight`(方向固定,**不跟随相机**)+
  一盏 `AmbientLight`(intensity 约 0.6,保证暗面不发黑)。
- 体积感来自面朝向的明度差异,不来自投影。
- `WebGLRenderer` 必须开 `antialias: true`。开启 `ACESFilmicToneMapping`,
  `toneMappingExposure` 约 1.1。背景用暖砂色,不要纯黑或纯白。
- 允许一层轻微 Bloom。**禁止 SSAO** — 接触阴影会与平涂风格冲突。

色板(不要自行选色,每个色相三档依次用于亮面、中间面、暗面):

```
砂岩    #E8D5B7  #D4B896  #A8906F
赭金    #E0A94F  #C08432  #8A5A1E
青金石  #4A6FA5  #2E4A73  #1B2E4A
椰枣绿  #7A9455  #5C7340  #3E4F2B
背景    #F2E4CE
```

视觉语言:阶梯状塔庙露台、砖砌水渠、棕榈与藤蔓。参考伊什塔尔门的釉砖拼贴——
平面色块,无纹理,无写实材质。避免:纪念碑谷换皮、古埃及式金色奢华、
波斯地毯式繁复。

### 四、可调参数必须集中

全部提取为 `src/config/style.ts` 中的具名常量,不得散落在各处硬编码:相机俯角、
方位角枚举值、正交视锥大小、过渡动画时长与缓动、`DirectionalLight` 的方向向量
与强度、`AmbientLight` 强度、`toneMappingExposure`、全部色板值、露台厚度、
檐口外扩量、台阶高度等几何比例常量。

这些值需要人眼反复调整,必须能在不改动逻辑代码的前提下修改。

### 五、关卡设计

四关,难度低,玩具感优先。教学全部由关卡结构承担,**不做文字教程**。

- **第一关 · 只有水** — 起点池 →(断开的渠)→ 终点池。转相机接上,水流过去填满。
  兽不参与。教规则 1、2。这一关应当短到几乎不算谜题。
- **第二关 · 只有人** — 渠是完整的,但兽够不到取水点。转相机让阶梯与平台在屏幕上
  接上,兽走上去站住,水自动流完。教规则 3。
- **第三关 · 水开出一条路** — 兽与终点之间有一个任何角度都接不上的断口。兽必须先去
  取水点放水,让横穿该断口的水渠灌满成桥,再踩着水面过去。必须包含一次「水流到
  一半停住」的诱导:玩家第一次尝试的角度会让水漏向一个没有池子的方向,水悬停在
  渠中。教规则 4、5。
- **第四关 · 桥造好了还得再转一次** — 两段渠、两个取水点。灌满第一段 → 踩着它走到
  第二个取水点 → 灌满第二段 → 此时第二段在当前角度下看起来是断的 → 再转一次相机
  才能走过去 → 填满终点大池。

通关条件是**终点大池被填满**,不是「水抵达终点」。大池水位渐进上涨,涨满瞬间整座
露台植物生长。

### 六、通关反馈

水流经的层级长出椰枣树与藤蔓。关卡开始时露台是光秃的石头,视野完全通透。解完时
枝叶填满画面,前景叶片垂到镜头前。这就是全部的通关反馈。**不做 HUD、不做过关弹窗、
不做进度条。** 遮挡只发生在谜题已解之后,不得在解题过程中遮挡关键接缝。

### 七、本版本不做

音频(全部)、移动端触控控件(只做桌面:鼠标点击 + 方向键 + Space,移动端能打开
即可)、拖拽操作、战斗、计时、分数、生命值、文字教程、菜单、标题画面、关卡选择、
存档、第二只引水兽。

### 八、工作方式

- 每次开工前先读 `PLAN.md`(规格里写作 `plan.md`;此仓库大小写不敏感,是同一个
  文件),只做该文件描述的当轮范围。
- **涉及新增关卡数据时,先输出数据字面量供确认,再写渲染与逻辑代码。**
- 其余(check、提交节奏、红状态)见上面的通用条目,不重复。

## Facts about this stack that have each cost a run

- **`tsconfig.include` is a whitelist, and a directory missing from it is
  silently untypechecked.** The template ships `["*.ts", "spec", "scripts"]`, so
  a module moved to `src/` "somewhere tidier" loses its types without a word ---
  `tsc --noEmit` stays green because it never looked. C5 added `"src"` to the
  list on purpose. Adding a directory is fine; *moving code into one that isn't
  listed* is the trap. Check the array before you reach for a new folder.
- **jsdom: `document.textContent` is `null`** on a Document node, per the DOM
  spec. Use `document.body.textContent`. A test that reads the former does not
  error, it just matches nothing --- so it passes while asserting nothing.
- **jsdom has neither `matchMedia` nor `<dialog>`'s `showModal`/`close`.** Stub
  what you need *before* importing the module under test, since a module that
  reads them at load time has already run by the time your `beforeEach` fires.
- **`[hidden]` loses to any class that sets `display`.** The UA rule is
  `display: none` at specificity (0,1,0), so `.steps { display: flex }` beats it
  and the attribute does nothing at all. Pair every attribute-driven hide with
  its own `.thing[hidden] { display: none }`.
- **Raster, when a week uses it:** `filter: invert()` only works on line art (a
  tonal drawing inverted is a photographic negative --- eye sockets come out
  brightest), and never back a lossy image with a rect in a "matching" colour,
  because the paper survives compression a few levels off and seams against it
  at a hard edge. Bake the margin into the image so there is only one surface.
