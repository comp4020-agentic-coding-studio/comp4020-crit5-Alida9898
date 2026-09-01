// Entry point. Lives at the repo root because that is where tsconfig looks
// (see CLAUDE.md on `tsconfig.include`).

import { mount } from "./src/play.ts";

const el = {
  canvas: document.querySelector<HTMLCanvasElement>("#board"),
  stage: document.querySelector<HTMLElement>("#stage"),
  handles: document.querySelector<HTMLElement>("#handles"),
  progress: document.querySelector<HTMLElement>("#progress"),
};

if (el.canvas && el.stage && el.handles && el.progress) {
  mount({ canvas: el.canvas, stage: el.stage, handles: el.handles, progress: el.progress });
}
