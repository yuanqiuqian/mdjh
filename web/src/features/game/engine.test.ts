import { describe, expect, it } from "vitest";
import { applyStoryResponse, applyTraining, createNewSave } from "@/features/game/engine";
import type { StoryResponse, TrainingAction } from "@/types/game";

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
});

