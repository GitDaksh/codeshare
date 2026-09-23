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