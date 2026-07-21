import { describe, expect, it } from "vitest";
import {
  applyStoryResponse,
  applyTraining,
  beginCombat,
  buildCombatFollowupPrompt,
  createNewSave,
  resolveCombatAction,
} from "@/features/game/engine";
import type { CombatSetupResponse, StoryResponse, TrainingAction } from "@/types/game";

describe("game engine", () => {
  it("createNewSave initializes opening scene", () => {
    const save = createNewSave("wudang");
    expect(save.player.age).toBe(16);
    expect(save.player.stats.level).toBe(1);
    expect(save.recentEvents.length).toBeGreaterThan(0);
    expect(save.suggestedActions.length).toBeGreaterThan(0);
  });

  it("applyTraining levels up and clamps resources", () => {
    const save = createNewSave("shaolin");
    const action: TrainingAction = {
      id: "test",
      name: "test",
      label: "闭关",
      description: "测试用修行。",
      deltas: { exp: 260, hp: 999, mp: 999, money: -999999 },
    };
    const { updated } = applyTraining(save, action);
    expect(updated.player.stats.level).toBeGreaterThan(save.player.stats.level);
    expect(updated.player.stats.exp).toBeGreaterThanOrEqual(0);
    expect(updated.player.stats.hp).toBeLessThanOrEqual(updated.player.stats.hpMax);
    expect(updated.player.stats.mp).toBeLessThanOrEqual(updated.player.stats.mpMax);
    expect(updated.player.money).toBeGreaterThanOrEqual(0);
  });

  it("applyStoryResponse accepts suggested options", () => {
    const save = createNewSave("kunlun");
    const response: StoryResponse = {
      narrative: "测试剧情",
      directives: {
        next_options: [{ label: "继续前行" }, { label: "回头观察" }],
        suggested_deltas: { hp_delta: -5, exp_delta: 10, money_delta: 2 },
        hooks: ["伏笔"],
      },
    };
    const updated = applyStoryResponse(save, "测试输入", response);
    expect(updated.recentEvents[0]?.narrative).toContain("测试剧情");
    expect(updated.suggestedActions).toEqual(["继续前行", "回头观察"]);
  });

  it("can enter combat mode and resolve an action", () => {
    const save = createNewSave("mingjiao");
    const setup: CombatSetupResponse = {
      title: "山道恶斗",
      objective: "击退山贼",
      introNarrative: "山贼拔刀围上。",
      canFlee: true,
      allies: [],
      enemies: [
        {
          id: "npc-bandit",
          name: "山贼首领",
          side: "enemy",
          level: 2,
          hp: 30,
          hpMax: 30,
          mp: 0,
          mpMax: 0,
          atk: 5,
          arm: 0,
          aspd: 1,
          skills: [],
          isBoss: true,
        },
      ],
    };

    const combatSave = beginCombat(save, setup);
    expect(combatSave.gameMode).toBe("combat");
    expect(combatSave.combatState?.enemies.length).toBe(1);

    const resolved = resolveCombatAction(combatSave, {
      type: "attack",
      targetId: "npc-bandit",
    });

    expect(resolved.updatedSave.player.stats.hp).toBeGreaterThanOrEqual(0);
    expect(resolved.updatedSave.recentEvents.length).toBeGreaterThan(0);
  });

  it("buildCombatFollowupPrompt summarizes the aftermath", () => {
    const save = createNewSave("wudang");
    const setup: CombatSetupResponse = {
      title: "山道恶斗",
      objective: "击退山贼",
      introNarrative: "山贼拔刀围上。",
      canFlee: true,
      allies: [],
      enemies: [
        {
          id: "npc-bandit",
          name: "山贼首领",
          side: "enemy",
          level: 2,
          hp: 1,
          hpMax: 30,
          mp: 0,
          mpMax: 0,
          atk: 5,
          arm: 0,
          aspd: 1,
          skills: [],
          isBoss: true,
        },
      ],
    };
    const combatSave = beginCombat(save, setup);
    const resolved = resolveCombatAction(combatSave, {
      type: "attack",
      targetId: "npc-bandit",
    });
    expect(resolved.result).toBe("victory");
    const prompt = buildCombatFollowupPrompt(resolved.updatedSave, "victory");
    expect(prompt).toContain("交战已经结束");
    expect(prompt).toContain("我方获胜");
  });
});
