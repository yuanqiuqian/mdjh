export type SectType = "力量型" | "敏捷型" | "智力型";

export type SectDefinition = {
  id: string;
  name: string;
  type: SectType;
  weapon: string;
  trait: string;
  starterSkill: string;
  flavor: string;
};

export type PlayerStats = {
  level: number;
  exp: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atk: number;
  aspd: number;
  arm: number;
  str: number;
  agi: number;
  int: number;
};

export type PlayerProfile = {
  name: string;
  age: number;
  sectId: string;
  title: string;
  personalitySummary: string;
  location: string;
  money: number;
  stats: PlayerStats;
};

export type RelationRecord = {
  id: string;
  name: string;
  favor: number;
  note: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  type: "武器" | "消耗品" | "秘籍" | "任务物";
  description: string;
};

export type EventRecord = {
  id: string;
  timestamp: string;
  sceneType: "dialogue" | "combat" | "rest" | "training" | "system";
  title: string;
  narrative: string;
  outcome: string;
  deltas?: {
    hp?: number;
    mp?: number;
    exp?: number;
    money?: number;
  };
};

export type SaveSlot = {
  slotId: string;
  name: string;
  updatedAt: string;
  player: PlayerProfile;
  relations: RelationRecord[];
  inventory: InventoryItem[];
  recentEvents: EventRecord[];
  longSummary: string[];
  suggestedActions: string[];
};

export type SaveEntry = {
  id: string;
  kind: "active" | "manual" | "stable";
  label: string;
  data: SaveSlot | null;
};

export type LlmConfig = {
  endpoint: string;
  modelId: string;
  apiKey: string;
  rememberOnDevice: boolean;
  lastValidatedAt?: string;
};

export type ValidateLlmConfigInput = {
  endpoint: string;
  modelId: string;
  apiKey: string;
};

export type ValidateLlmConfigResult = {
  success: boolean;
  latencyMs: number;
  message: string;
};

export type StoryOption = {
  label: string;
  hint?: string;
  risk?: string;
};

export type StoryDirectiveDelta = {
  hp_delta?: number;
  mp_delta?: number;
  exp_delta?: number;
  money_delta?: number;
};

export type StoryResponse = {
  narrative: string;
  directives?: {
    next_options?: StoryOption[];
    suggested_deltas?: StoryDirectiveDelta;
    hooks?: string[];
  };
};

export type TrainingAction = {
  id: string;
  name: string;
  label: string;
  description: string;
  deltas: {
    hp?: number;
    mp?: number;
    exp?: number;
    money?: number;
  };
};
