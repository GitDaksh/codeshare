export type LanguageUpdateEvent = {
  language: string;
  userId: string;
  name: string;
};

export type RunStartEvent = {
  userId: string;
  name: string;
  avatarId: string;
  language: string;
};

export type RunResultEvent = RunStartEvent & {
  output: string;
  error: string | null;
  durationMs: number;
};

// ---------- Lens (shared step-by-step visualizations) ----------

export type LensDriver = {
  userId: string;
  name: string;
  avatarId: string;
};

export type LensSessionEvent = {
  id: string;
  title: string;
  code: string;
  // The recording, gzip-compressed JSON (see lib/lensShare.ts).
  trace: ArrayBuffer;
  driver: LensDriver | null;
  step: number;
  // True when it was just started, false when catching up after joining.
  fresh: boolean;
};

export type LensStepEvent = { id: string; step: number };

export type LensDriverEvent = { id: string; driver: LensDriver | null; step: number };

export type LensStopEvent = { id: string };