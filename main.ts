// Entry point. Lives at the repo root because that is where tsconfig looks
// (see CLAUDE.md on `tsconfig.include`).
//
// Round 1 is the rules and the level data only — see PLAN.md. Rendering lands
// in round 2, so for now this does nothing but hand the stylesheet the
// palette, and the stage is deliberately empty.

import { BACKGROUND, PALETTE } from "./src/config/style.ts";

const root = document.documentElement.style;
root.setProperty("--background", BACKGROUND);
for (const [hue, tones] of Object.entries(PALETTE)) {
  for (const [tone, value] of Object.entries(tones)) {
    root.setProperty(`--${hue}-${tone}`, value);
  }
}
