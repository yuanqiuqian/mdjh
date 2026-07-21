import { sects } from "@/data/game-data";
import type {
  CombatActionInput,
  CombatResolution,
  CombatRoundLog,
  CombatSetupResponse,
  CombatSkill,
  CombatState,
  Combatant,
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

const createPlayerSkills = (sect: SectDefinition): CombatSkill[] => {
  const sectSkillPower =
    sect.type === "力量型" ? 26 : sect.type === "敏捷型" ? 22 : 24;
  return [
    {
      id: `${sect.id}-starter`,
      name: sect.starterSkill,
      description: `施展${sect.name}入门招式，对单体造成更高伤害。`,
      mpCost: 12,
      power: sectSkillPower,
      target: "enemy",
      kind: "damage",
    },
    {
      id: "recover-breath",
      name: "调息回气",
      description: "短暂稳住呼吸，回复少量气血与内力。",
      mpCost: 8,
      power: 18,
      target: "self",
      kind: "recover",
    },
  ];
};

const defaultEnemySkill = (name: string): CombatSkill => ({
  id: `${name}-strike`,
  name: "凶狠扑杀",
  description: "山野亡命徒的粗暴攻击。",
  mpCost: 0,
  power: 18,
  target: "enemy",
  kind: "damage",
});

const createPlayerCombatant = (slot: SaveSlot): Combatant => {
  const sect = getSectById(slot.player.sectId);
  return {
    id: "player",
    name: slot.player.name,
    side: "player",
    level: slot.player.stats.level,
    hp: slot.player.stats.hp,
    hpMax: slot.player.stats.hpMax,
    mp: slot.player.stats.mp,
    mpMax: slot.player.stats.mpMax,
    atk: slot.player.stats.atk,
    arm: slot.player.stats.arm,
    aspd: slot.player.stats.aspd,
    skills: createPlayerSkills(sect),
    status: {},
  };
};

const normalizeCombatant = (input: Combatant, side: Combatant["side"]): Combatant => ({
  id: input.id,
  name: input.name,
  side,
  level: Math.max(1, input.level || 1),
  hp: Math.max(1, Math.round(input.hp || input.hpMax || 80)),
  hpMax: Math.max(1, Math.round(input.hpMax || input.hp || 80)),
  mp: Math.max(0, Math.round(input.mp || input.mpMax || 0)),
  mpMax: Math.max(0, Math.round(input.mpMax || input.mp || 0)),
  atk: Math.max(8, Math.round(input.atk || 16)),
  arm: Math.max(0, Math.round(input.arm || 6)),
  aspd: Math.max(0.6, Number((input.aspd || 1).toFixed(2))),
  skills:
    input.skills && input.skills.length > 0
      ? input.skills.map((skill) => ({
          ...skill,
          mpCost: Math.max(0, Math.round(skill.mpCost || 0)),
          power: Math.max(1, Math.round(skill.power || 10)),
        }))
      : [defaultEnemySkill(input.name)],
  status: input.status ?? {},
  isBoss: input.isBoss,
});

const damageVariance = () => 0.9 + Math.random() * 0.2;

const applyDamage = (target: Combatant, amount: number) => {
  const reduced = target.status?.defending ? Math.round(amount * 0.55) : amount;
  const nextHp = clamp(target.hp - reduced, 0, target.hpMax);
  return {
    target: { ...target, hp: nextHp },
    actual: target.hp - nextHp,
  };
};

const basicAttackDamage = (actor: Combatant, target: Combatant) =>
  Math.max(4, Math.round(actor.atk * damageVariance() - target.arm * 0.45));

const skillDamage = (actor: Combatant, target: Combatant, skill: CombatSkill) =>
  Math.max(6, Math.round((actor.atk + skill.power) * damageVariance() - target.arm * 0.35));

const findCombatant = (list: Combatant[], id: string) => list.find((item) => item.id === id);

const updateCombatant = (list: Combatant[], next: Combatant) =>
  list.map((item) => (item.id === next.id ? next : item));

const aliveEnemies = (combat: CombatState) => combat.enemies.filter((enemy) => enemy.hp > 0);

const syncPlayerStats = (save: SaveSlot, combatPlayer: Combatant) => ({
  ...save,
  player: {
    ...save.player,
    stats: {
      ...save.player.stats,
      hp: combatPlayer.hp,
      hpMax: combatPlayer.hpMax,
      mp: combatPlayer.mp,
      mpMax: combatPlayer.mpMax,
      atk: combatPlayer.atk,
      arm: combatPlayer.arm,
      aspd: combatPlayer.aspd,
      level: combatPlayer.level,
    },
  },
});

const summarizeCombatLogs = (logs: CombatState["logs"]) =>
  logs
    .slice(-4)
    .map((log) => log.summary)
    .join(" ");

const finalizeCombat = (
  save: SaveSlot,
  combat: CombatState,
  result: "victory" | "defeat" | "fled",
): SaveSlot => {
  const player = { ...combat.player, status: {} };
  let updated: SaveSlot = syncPlayerStats(save, player);
  const latestEnemyName = combat.enemies.find((enemy) => enemy.isBoss)?.name ?? combat.enemies[0]?.name ?? "敌人";
  const summary =
    result === "victory"
      ? `你在第 ${combat.round} 回合击溃了${latestEnemyName}一方。`
      : result === "fled"
        ? `你趁乱脱离了战场，暂时摆脱${latestEnemyName}的追击。`
        : `你在激斗中落败，被迫退出这场冲突。`;
  const nextActions =
    result === "victory"
      ? ["搜查战场", "安抚路人", "继续上路"]
      : result === "fled"
        ? ["先疗伤", "回头观察", "继续赶路"]
        : ["疗伤", "整理思绪", "查看卷册"];

  const event: EventRecord = {
    id: makeId("evt"),
    timestamp: new Date().toISOString(),
    sceneType: "combat",
    title: `战斗结算：${combat.title}`,
    narrative: combat.introNarrative,
    outcome: `${summary} ${summarizeCombatLogs(combat.logs)}`.trim(),
    deltas: {
      hp: player.hp - save.player.stats.hp,
      mp: player.mp - save.player.stats.mp,
    },
  };

  updated = {
    ...updated,
    updatedAt: new Date().toISOString(),
    gameMode: "dialogue",
    combatState: null,
    recentEvents: [event, ...updated.recentEvents].slice(0, 50),
    longSummary: [
      ...updated.longSummary,
      `${new Date().toLocaleString("zh-CN")}：${summary}`,
    ].slice(-12),
    suggestedActions: nextActions,
    relations: updated.relations.map((relation) => {
      if (combat.enemies.some((enemy) => enemy.id === relation.id)) {
        return {
          ...relation,
          favor: result === "victory" ? -100 : result === "fled" ? relation.favor - 10 : relation.favor - 20,
          note: result === "victory" ? "你在战斗中彻底压制了对方。" : "战斗后的敌意进一步加深。",
        };
      }
      if (relation.id === "npc-passenger" && result === "victory") {
        return {
          ...relation,
          favor: relation.favor + 20,
          note: "你出手击退山贼后，对方对你感激不尽。",
        };
      }
      return relation;
    }),
  };

  return updated;
};

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
    gameMode: "dialogue",
    player,
    relations: [
      { id: "npc-passenger", name: "受困路人", favor: 0, note: "尚未交谈。" },
      { id: "npc-bandit", name: "山贼首领", favor: -10, note: "目露凶光，态度不善。" },
    ],
    inventory: createStarterInventory(sect),
    recentEvents: [openingEvent],
    longSummary: ["你刚下山，尚未形成固定立场，江湖将根据你的选择逐步回应。"],
    suggestedActions: ["上前相助", "暗中观察", "与山贼交涉"],
    combatState: null,
  };
};

export const createCombatState = (
  save: SaveSlot,
  setup: CombatSetupResponse,
): CombatState => ({
  id: makeId("combat"),
  title: setup.title,
  objective: setup.objective,
  introNarrative: setup.introNarrative,
  player: createPlayerCombatant(save),
  allies: (setup.allies ?? []).map((ally) => normalizeCombatant(ally, "ally")),
  enemies: (setup.enemies ?? []).map((enemy) => normalizeCombatant(enemy, "enemy")),
  round: 1,
  canFlee: setup.canFlee,
  logs: [],
});

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
    sceneType:
      response.directives?.scene_type === "combat" ||
      response.directives?.mode_transition?.to === "combat"
        ? "combat"
        : "dialogue",
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

export const beginCombat = (slot: SaveSlot, setup: CombatSetupResponse): SaveSlot => ({
  ...slot,
  updatedAt: new Date().toISOString(),
  gameMode: "combat",
  combatState: createCombatState(slot, setup),
});

export const resolveCombatAction = (
  slot: SaveSlot,
  action: CombatActionInput,
): CombatResolution => {
  const combat = slot.combatState;
  if (!combat) {
    return {
      combat: null,
      updatedSave: slot,
      finished: false,
      result: null,
    };
  }

  let nextCombat: CombatState = {
    ...combat,
    player: { ...combat.player, status: {} },
    enemies: combat.enemies.map((enemy) => ({ ...enemy, status: {} })),
    allies: combat.allies.map((ally) => ({ ...ally, status: {} })),
    logs: [...combat.logs],
  };
  let nextInventory = [...slot.inventory];

  const pushLog = (actorName: string, actorId: string, actionType: CombatRoundLog["actionType"], summary: string) => {
    nextCombat = {
      ...nextCombat,
      logs: [
        ...nextCombat.logs,
        {
          id: makeId("clog"),
          round: nextCombat.round,
          actorId,
          actorName,
          actionType,
          summary,
        },
      ].slice(-24),
    };
  };

  if (action.type === "attack") {
    const target = findCombatant(nextCombat.enemies, action.targetId);
    if (target && target.hp > 0) {
      const damage = basicAttackDamage(nextCombat.player, target);
      const { target: updatedTarget, actual } = applyDamage(target, damage);
      nextCombat = { ...nextCombat, enemies: updateCombatant(nextCombat.enemies, updatedTarget) };
      pushLog(nextCombat.player.name, nextCombat.player.id, "attack", `${nextCombat.player.name}挥出兵刃，命中${target.name}，造成 ${actual} 点伤害。`);
    }
  }

  if (action.type === "defend") {
    nextCombat = {
      ...nextCombat,
      player: {
        ...nextCombat.player,
        status: { ...nextCombat.player.status, defending: true },
      },
    };
    pushLog(nextCombat.player.name, nextCombat.player.id, "defend", `${nextCombat.player.name}稳住架势，本回合将大幅减伤。`);
  }

  if (action.type === "skill") {
    const skill = nextCombat.player.skills.find((item) => item.id === action.skillId);
    if (!skill) {
      pushLog(nextCombat.player.name, nextCombat.player.id, "skill", `${nextCombat.player.name}试图运功，却没能使出有效招式。`);
    } else if (nextCombat.player.mp < skill.mpCost) {
      pushLog(nextCombat.player.name, nextCombat.player.id, "skill", `${nextCombat.player.name}内力不足，${skill.name}未能成功施展。`);
    } else if (skill.kind === "recover") {
      const nextHp = clamp(nextCombat.player.hp + skill.power, 0, nextCombat.player.hpMax);
      const nextMp = clamp(nextCombat.player.mp - skill.mpCost + Math.round(skill.power * 0.45), 0, nextCombat.player.mpMax);
      nextCombat = {
        ...nextCombat,
        player: {
          ...nextCombat.player,
          hp: nextHp,
          mp: nextMp,
        },
      };
      pushLog(nextCombat.player.name, nextCombat.player.id, "skill", `${nextCombat.player.name}运转${skill.name}，恢复了伤势与气息。`);
    } else {
      const targetId = action.targetId ?? aliveEnemies(nextCombat)[0]?.id;
      const target = targetId ? findCombatant(nextCombat.enemies, targetId) : undefined;
      if (target && target.hp > 0) {
        const damage = skillDamage(nextCombat.player, target, skill);
        const { target: updatedTarget, actual } = applyDamage(target, damage);
        nextCombat = {
          ...nextCombat,
          player: { ...nextCombat.player, mp: clamp(nextCombat.player.mp - skill.mpCost, 0, nextCombat.player.mpMax) },
          enemies: updateCombatant(nextCombat.enemies, updatedTarget),
        };
        pushLog(nextCombat.player.name, nextCombat.player.id, "skill", `${nextCombat.player.name}施展${skill.name}，对${target.name}造成 ${actual} 点伤害。`);
      }
    }
  }

  if (action.type === "item") {
    const itemIndex = nextInventory.findIndex((item) => item.id === action.itemId);
    const item = itemIndex >= 0 ? nextInventory[itemIndex] : undefined;
    if (item && item.type === "消耗品") {
      nextInventory.splice(itemIndex, 1);
      const recoverHp = item.name.includes("伤") ? 24 : 10;
      const recoverMp = item.name.includes("气") ? 22 : 6;
      nextCombat = {
        ...nextCombat,
        player: {
          ...nextCombat.player,
          hp: clamp(nextCombat.player.hp + recoverHp, 0, nextCombat.player.hpMax),
          mp: clamp(nextCombat.player.mp + recoverMp, 0, nextCombat.player.mpMax),
        },
      };
      pushLog(nextCombat.player.name, nextCombat.player.id, "item", `${nextCombat.player.name}使用${item.name}，回复状态后继续应战。`);
    } else {
      pushLog(nextCombat.player.name, nextCombat.player.id, "item", `${nextCombat.player.name}翻找道具，却没找到能立刻派上用场的物品。`);
    }
  }

  if (action.type === "flee") {
    const escapeChance = Math.min(0.9, 0.35 + nextCombat.player.aspd * 0.18 - aliveEnemies(nextCombat).length * 0.06);
    if (nextCombat.canFlee && Math.random() < escapeChance) {
      pushLog(nextCombat.player.name, nextCombat.player.id, "flee", `${nextCombat.player.name}抓住空档脱离战场。`);
      const updatedSave = finalizeCombat(
        {
          ...slot,
          inventory: nextInventory,
          combatState: nextCombat,
        },
        nextCombat,
        "fled",
      );
      return { combat: null, updatedSave, finished: true, result: "fled" };
    }
    pushLog(nextCombat.player.name, nextCombat.player.id, "flee", `${nextCombat.player.name}试图抽身撤离，却被敌人死死缠住。`);
  }

  if (aliveEnemies(nextCombat).length === 0) {
    const updatedSave = finalizeCombat(
      {
        ...slot,
        inventory: nextInventory,
        combatState: nextCombat,
      },
      nextCombat,
      "victory",
    );
    return { combat: null, updatedSave, finished: true, result: "victory" };
  }

  for (const enemy of aliveEnemies(nextCombat)) {
    let actingEnemy = findCombatant(nextCombat.enemies, enemy.id);
    if (!actingEnemy || actingEnemy.hp <= 0) {
      continue;
    }
    const usableRecover = actingEnemy.skills.find(
      (skill) => skill.kind === "recover" && actingEnemy && actingEnemy.mp >= skill.mpCost && actingEnemy.hp / actingEnemy.hpMax < 0.35,
    );
    const usableDamage = actingEnemy.skills.find(
      (skill) => skill.kind === "damage" && actingEnemy && actingEnemy.mp >= skill.mpCost,
    );

    if (usableRecover) {
      actingEnemy = {
        ...actingEnemy,
        hp: clamp(actingEnemy.hp + usableRecover.power, 0, actingEnemy.hpMax),
        mp: clamp(actingEnemy.mp - usableRecover.mpCost, 0, actingEnemy.mpMax),
      };
      nextCombat = { ...nextCombat, enemies: updateCombatant(nextCombat.enemies, actingEnemy) };
      pushLog(actingEnemy.name, actingEnemy.id, "skill", `${actingEnemy.name}运转${usableRecover.name}，暂时稳住伤势。`);
      continue;
    }

    if (usableDamage && Math.random() < (actingEnemy.isBoss ? 0.55 : 0.35)) {
      const damage = skillDamage(actingEnemy, nextCombat.player, usableDamage);
      const { target: updatedPlayer, actual } = applyDamage(nextCombat.player, damage);
      nextCombat = {
        ...nextCombat,
        player: updatedPlayer,
        enemies: updateCombatant(nextCombat.enemies, {
          ...actingEnemy,
          mp: clamp(actingEnemy.mp - usableDamage.mpCost, 0, actingEnemy.mpMax),
        }),
      };
      pushLog(actingEnemy.name, actingEnemy.id, "skill", `${actingEnemy.name}使出${usableDamage.name}，对你造成 ${actual} 点伤害。`);
    } else {
      const damage = basicAttackDamage(actingEnemy, nextCombat.player);
      const { target: updatedPlayer, actual } = applyDamage(nextCombat.player, damage);
      nextCombat = { ...nextCombat, player: updatedPlayer };
      pushLog(actingEnemy.name, actingEnemy.id, "attack", `${actingEnemy.name}趁隙猛攻，对你造成 ${actual} 点伤害。`);
    }

    if (nextCombat.player.hp <= 0) {
      const updatedSave = finalizeCombat(
        {
          ...slot,
          inventory: nextInventory,
          combatState: nextCombat,
        },
        nextCombat,
        "defeat",
      );
      return { combat: null, updatedSave, finished: true, result: "defeat" };
    }
  }

  nextCombat = {
    ...nextCombat,
    round: nextCombat.round + 1,
    player: {
      ...nextCombat.player,
      status: {},
    },
  };

  const updatedSave = {
    ...syncPlayerStats(slot, nextCombat.player),
    updatedAt: new Date().toISOString(),
    inventory: nextInventory,
    gameMode: "combat" as const,
    combatState: nextCombat,
  };

  return {
    combat: nextCombat,
    updatedSave,
    finished: false,
    result: null,
  };
};

export const buildCombatFollowupPrompt = (
  save: SaveSlot,
  result: "victory" | "defeat" | "fled",
) => {
  const combatEvent = save.recentEvents[0];
  const player = save.player;
  const resultLabel =
    result === "victory" ? "我方获胜" : result === "defeat" ? "我方落败" : "我方成功脱离";

  return [
    "交战已经结束，请直接续写战后剧情，不要重新描写同一场战斗的出招过程。",
    `战斗结果：${resultLabel}。`,
    `战斗摘要：${combatEvent?.outcome ?? "战斗已经收束。"}`,
    `当前状态：HP ${player.stats.hp}/${player.stats.hpMax}，MP ${player.stats.mp}/${player.stats.mpMax}，银两 ${player.money}。`,
    "请重点描写现场反应、敌我关系变化、掉落/线索/后续选择，并给出新的对话模式选项。",
  ].join("\n");
};
