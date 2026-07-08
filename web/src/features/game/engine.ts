import { sects } from "@/data/game-data";
import type {
  EventRecord,
  InventoryItem,
  PlayerProfile,
  PlayerStats,
  SaveSlot,
  SectDefinition,
  StoryResponse,
  TrainingAction,
} from "@/types/game";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const createBaseStats = (sect: SectDefinition): PlayerStats => {
  const base = {
    level: 1,
    exp: 0,
    hp: 96,
    hpMax: 96,
    mp: 64,
    mpMax: 64,
    atk: 18,
    aspd: 1.06,
    arm: 8,
    str: 9,
    agi: 9,
    int: 9,
  };

  if (sect.type === "力量型") {
    return { ...base, hp: 118, hpMax: 118, atk: 21, arm: 10, str: 12, agi: 8, int: 7 };
  }
  if (sect.type === "敏捷型") {
    return { ...base, hp: 98, hpMax: 98, atk: 19, aspd: 1.2, arm: 9, str: 8, agi: 12, int: 8 };
  }
  return { ...base, hp: 92, hpMax: 92, mp: 82, mpMax: 82, atk: 18, aspd: 1.1, arm: 8, str: 7, agi: 9, int: 12 };
};

const createStarterInventory = (sect: SectDefinition): InventoryItem[] => [
  {
    id: "weapon-starter",
    name: `${sect.weapon}（入门）`,
    type: "武器",
    description: `来自${sect.name}的新手兵刃，适合刚下山时使用。`,
  },
  {
    id: "potion-small",
    name: "小还气散",
    type: "消耗品",
    description: "缓慢恢复内息的基础药物。",
  },
  {
    id: "manual-basic",
    name: `${sect.name}入门心法`,
    type: "秘籍",
    description: "记录本门根基吐纳与行气要诀。",
  },
];

export const makeId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const getSectById = (sectId: string) =>
  sects.find((sect) => sect.id === sectId) ?? sects[0];

export const createNewSave = (sectId: string): SaveSlot => {
  const sect = getSectById(sectId);
  const stats = createBaseStats(sect);

  const player: PlayerProfile = {
    name: "无名少侠",
    age: 16,
    sectId: sect.id,
    title: `${sect.name}新徒`,
    personalitySummary: "初出茅庐，行事尚未定型，愿以一次次抉择雕刻自己的江湖名号。",
    location: "青石古道",
    money: 28,
    stats,
  };

  const openingEvent: EventRecord = {
    id: makeId("evt"),
    timestamp: new Date().toISOString(),
    sceneType: "dialogue",
    title: "初下山门",
    narrative:
      "暮色压在山脊上，你背着行囊走下石阶。前方古道传来呼喝声，似有山贼正在拦路索财。",
    outcome: "第一幕开启：你将通过抉择决定自己在江湖中的立场。",
  };

  return {
    slotId: "active",
    name: "当前进度",
    updatedAt: new Date().toISOString(),
    player,
    relations: [
      { id: "npc-passenger", name: "受困路人", favor: 0, note: "尚未交谈。" },
      { id: "npc-bandit", name: "山贼首领", favor: -10, note: "目露凶光，态度不善。" },
    ],
    inventory: createStarterInventory(sect),
    recentEvents: [openingEvent],
    longSummary: ["你刚下山，尚未形成固定立场，江湖将根据你的选择逐步回应。"],
    suggestedActions: ["上前相助", "暗中观察", "与山贼交涉"],
  };
};

export const applyTraining = (
  slot: SaveSlot,
  action: TrainingAction,
): { updated: SaveSlot; event: EventRecord } => {
  const stats = { ...slot.player.stats };
  const moneyAfter = clamp(slot.player.money + (action.deltas.money ?? 0), 0, 999999);
  const hpAfter = clamp(stats.hp + (action.deltas.hp ?? 0), 0, stats.hpMax);
  const mpAfter = clamp(stats.mp + (action.deltas.mp ?? 0), 0, stats.mpMax);

  const expGain = Math.max(0, action.deltas.exp ?? 0);
  const levelBefore = stats.level;
  const expTotal = stats.exp + expGain;
  const levelUps = Math.floor(expTotal / 100);
  const nextLevel = stats.level + levelUps;
  const restExp = expTotal % 100;

  const hpMax = stats.hpMax + levelUps * 8;
  const mpMax = stats.mpMax + levelUps * 6;

  const nextStats: PlayerStats = {
    ...stats,
    level: nextLevel,
    exp: restExp,
    hpMax,
    mpMax,
    hp: clamp(hpAfter + levelUps * 8, 0, hpMax),
    mp: clamp(mpAfter + levelUps * 6, 0, mpMax),
    atk: stats.atk + levelUps * 2,
    arm: stats.arm + levelUps,
    aspd: Number((stats.aspd + levelUps * 0.01).toFixed(2)),
    str: stats.str + levelUps,
    agi: stats.agi + levelUps,
    int: stats.int + levelUps,
  };

  const levelText =
    nextStats.level > levelBefore
      ? `修行突破至 ${nextStats.level} 级。`
      : "根基略有精进。";

  const event: EventRecord = {
    id: makeId("evt"),
    timestamp: new Date().toISOString(),
    sceneType: "training",
    title: `离线修行：${action.label}`,
    narrative: action.description,
    outcome: `${levelText} 你对江湖的理解更深了一层。`,
    deltas: {
      hp: nextStats.hp - stats.hp,
      mp: nextStats.mp - stats.mp,
      exp: expGain,
      money: moneyAfter - slot.player.money,
    },
  };

  const updated: SaveSlot = {
    ...slot,
    updatedAt: new Date().toISOString(),
    player: {
      ...slot.player,
      money: moneyAfter,
      stats: nextStats,
    },
    recentEvents: [event, ...slot.recentEvents].slice(0, 50),
    longSummary: [
      ...slot.longSummary,
      `${new Date().toLocaleString("zh-CN")}：完成${action.label}，${event.outcome}`,
    ].slice(-12),
  };

  return { updated, event };
};

export const applyStoryResponse = (
  slot: SaveSlot,
  userInput: string,
  response: StoryResponse,
): SaveSlot => {
  const stats = slot.player.stats;
  const deltas = response.directives?.suggested_deltas;
  const nextHp = clamp(stats.hp + (deltas?.hp_delta ?? 0), 0, stats.hpMax);
  const nextMp = clamp(stats.mp + (deltas?.mp_delta ?? 0), 0, stats.mpMax);
  const nextMoney = clamp(slot.player.money + (deltas?.money_delta ?? 0), 0, 999999);
  const expGain = Math.max(0, deltas?.exp_delta ?? 0);

  const totalExp = stats.exp + expGain;
  const levelUps = Math.floor(totalExp / 100);
  const nextLevel = stats.level + levelUps;
  const restExp = totalExp % 100;
  const nextHpMax = stats.hpMax + levelUps * 8;
  const nextMpMax = stats.mpMax + levelUps * 6;

  const nextStats: PlayerStats = {
    ...stats,
    level: nextLevel,
    exp: restExp,
    hpMax: nextHpMax,
    mpMax: nextMpMax,
    hp: clamp(nextHp + levelUps * 8, 0, nextHpMax),
    mp: clamp(nextMp + levelUps * 6, 0, nextMpMax),
    atk: stats.atk + levelUps * 2,
    arm: stats.arm + levelUps,
    aspd: Number((stats.aspd + levelUps * 0.01).toFixed(2)),
    str: stats.str + levelUps,
    agi: stats.agi + levelUps,
    int: stats.int + levelUps,
  };

  const event: EventRecord = {
    id: makeId("evt"),
    timestamp: new Date().toISOString(),
    sceneType: "dialogue",
    title: `江湖回合：${userInput.slice(0, 12) || "继续前行"}`,
    narrative: response.narrative,
    outcome:
      response.directives?.hooks?.[0] ??
      "局势继续向前推进，你的一举一动开始在江湖中留下回音。",
    deltas: {
      hp: nextStats.hp - stats.hp,
      mp: nextStats.mp - stats.mp,
      exp: expGain,
      money: nextMoney - slot.player.money,
    },
  };

  const nextOptions =
    response.directives?.next_options?.map((item) => item.label).filter(Boolean) ?? [];

  return {
    ...slot,
    updatedAt: new Date().toISOString(),
    player: {
      ...slot.player,
      money: nextMoney,
      stats: nextStats,
    },
    recentEvents: [event, ...slot.recentEvents].slice(0, 50),
    longSummary: [
      ...slot.longSummary,
      `${new Date().toLocaleString("zh-CN")}：${event.title}，${event.outcome}`,
    ].slice(-12),
    suggestedActions: nextOptions.length > 0 ? nextOptions : slot.suggestedActions,
  };
};
