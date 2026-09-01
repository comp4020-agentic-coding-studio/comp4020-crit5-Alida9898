// Entry point. Lives at the repo root because that is where tsconfig looks
// (see CLAUDE.md on `tsconfig.include`).

import { BACKGROUND, PALETTE } from "./src/config/style.ts";
import { mount } from "./src/play.ts";

const root = document.documentElement.style;
root.setProperty("--background", BACKGROUND);
for (const [hue, tones] of Object.entries(PALETTE)) {
  for (const [tone, value] of Object.entries(tones)) {
    root.setProperty(`--${hue}-${tone}`, value);
  }
}

const el = {
  canvas: document.querySelector<HTMLCanvasElement>("#board"),
  stage: document.querySelector<HTMLElement>("#stage"),
  handles: document.querySelector<HTMLElement>("#handles"),
  progress: document.querySelector<HTMLElement>("#progress"),
};

if (el.canvas && el.stage && el.handles && el.progress) {
  mount({ canvas: el.canvas, stage: el.stage, handles: el.handles, progress: el.progress });
}
