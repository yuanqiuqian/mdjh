export type SectType = "力量型" | "敏捷型" | "智力型";
export type GameMode = "dialogue" | "combat" | "gameover";

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

export type CombatSkill = {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  power: number;
  target: "enemy" | "self";
  kind: "damage" | "recover";
};

export type CombatStatus = {
  defending?: boolean;
};

export type Combatant = {
  id: string;
  name: string;
  side: "player" | "enemy" | "ally";
  level: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atk: number;
  arm: number;
  aspd: number;
  skills: CombatSkill[];
  status?: CombatStatus;
  isBoss?: boolean;
};

export type CombatRoundLog = {
  id: string;
  round: number;
  actorId: string;
  actorName: string;
  actionType: "attack" | "defend" | "skill" | "item" | "flee";
  summary: string;
};

export type CombatState = {
  id: string;
  title: string;
  objective: string;
  introNarrative: string;
  player: Combatant;
  enemies: Combatant[];
  allies: Combatant[];
  round: number;
  canFlee: boolean;
  logs: CombatRoundLog[];
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
  gameMode: GameMode;
  player: PlayerProfile;
  relations: RelationRecord[];
  inventory: InventoryItem[];
  recentEvents: EventRecord[];
  longSummary: string[];
  suggestedActions: string[];
  combatState: CombatState | null;
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
    scene_type?: GameMode;
    next_options?: StoryOption[];
    suggested_deltas?: StoryDirectiveDelta;
    hooks?: string[];
    mode_transition?: {
      to: GameMode;
      reason: string;
    };
    combat_hint?: {
      title?: string;
      objective?: string;
      can_flee?: boolean;
    };
  };
};

export type StoryDebugInfo = {
  requestedAt: string;
  userInput: string;
  requestUrl: string;
  requestBody: string;
  transport: "json" | "sse";
  fallbackUsed: boolean;
  finishReason: string | null;
  narrativePreview: string | null;
  rawPayload: string | null;
  rawContent: string | null;
  parsedStory: StoryResponse | null;
  errorMessage: string | null;
};

export type CombatSetupResponse = {
  title: string;
  objective: string;
  introNarrative: string;
  canFlee: boolean;
  allies: Combatant[];
  enemies: Combatant[];
};

export type CombatActionInput =
  | {
      type: "attack";
      targetId: string;
    }
  | {
      type: "defend";
    }
  | {
      type: "skill";
      skillId: string;
      targetId?: string;
    }
  | {
      type: "item";
      itemId: string;
    }
  | {
      type: "flee";
    };

export type CombatResolution = {
  combat: CombatState | null;
  updatedSave: SaveSlot;
  finished: boolean;
  result: "victory" | "defeat" | "fled" | null;
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
