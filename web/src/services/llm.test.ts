import { describe, expect, it } from "vitest";
import {
  buildChatCompletionsUrl,
  extractNarrativePreview,
  parseCombatSetupResponse,
  parseStoryResponse,
} from "@/services/llm";

describe("llm helpers", () => {
  it("buildChatCompletionsUrl normalizes base endpoint", () => {
    expect(buildChatCompletionsUrl("https://api.example.com")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
    expect(buildChatCompletionsUrl("https://api.example.com/")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  it("buildChatCompletionsUrl appends chat/completions to /v1", () => {
    expect(buildChatCompletionsUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  it("buildChatCompletionsUrl keeps full chat/completions path", () => {
    expect(buildChatCompletionsUrl("https://api.example.com/v1/chat/completions")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  it("parseStoryResponse extracts json and clamps deltas", () => {
    const content = `\n\`\`\`json\n{\n  "narrative": "风起云涌",\n  "directives": {\n    "next_options": [{ "label": "拔剑" }, { "label": "退让" }],\n    "suggested_deltas": { "hp_delta": -999, "mp_delta": 999, "exp_delta": 0.2, "money_delta": 42 },\n    "hooks": ["test"]\n  }\n}\n\`\`\`\n`;
    const parsed = parseStoryResponse(content);
    expect(parsed.narrative).toBe("风起云涌");
    expect(parsed.directives?.next_options?.map((item) => item.label)).toEqual(["拔剑", "退让"]);
    expect(parsed.directives?.suggested_deltas?.hp_delta).toBe(-20);
    expect(parsed.directives?.suggested_deltas?.mp_delta).toBe(20);
    expect(parsed.directives?.suggested_deltas?.exp_delta).toBe(0);
    expect(parsed.directives?.suggested_deltas?.money_delta).toBe(20);
  });

  it("extractNarrativePreview reads partial streamed narrative text", () => {
    const partial =
      '{"narrative":"雨声渐密，客栈外的灯火在风里摇晃\\n你按住剑柄，听见门外有马蹄';
    expect(extractNarrativePreview(partial)).toBe(
      "雨声渐密，客栈外的灯火在风里摇晃\n你按住剑柄，听见门外有马蹄",
    );
  });

  it("parseStoryResponse keeps mode transition metadata", () => {
    const content = JSON.stringify({
      narrative: "山贼拔刀扑来。",
      directives: {
        scene_type: "combat",
        next_options: [{ label: "迎战" }],
        mode_transition: {
          to: "combat",
          reason: "冲突已经升级成正面厮杀。",
        },
        combat_hint: {
          title: "古道交战",
          objective: "击退山贼",
          can_flee: true,
        },
      },
    });
    const parsed = parseStoryResponse(content);
    expect(parsed.directives?.scene_type).toBe("combat");
    expect(parsed.directives?.mode_transition?.to).toBe("combat");
    expect(parsed.directives?.combat_hint?.title).toBe("古道交战");
  });

  it("parseCombatSetupResponse extracts battle roster", () => {
    const content = JSON.stringify({
      title: "青石古道恶斗",
      objective: "击退山贼首领",
      introNarrative: "刀光一闪，双方正式开打。",
      canFlee: true,
      enemies: [
        {
          id: "npc-bandit",
          name: "山贼首领",
          level: 2,
          hp: 120,
          hpMax: 120,
          mp: 10,
          mpMax: 10,
          atk: 20,
          arm: 8,
          aspd: 0.95,
          isBoss: true,
          skills: [{ id: "cut", name: "猛斩", mpCost: 4, power: 20, target: "enemy", kind: "damage" }],
        },
      ],
    });
    const parsed = parseCombatSetupResponse(content);
    expect(parsed.title).toBe("青石古道恶斗");
    expect(parsed.enemies[0]?.name).toBe("山贼首领");
    expect(parsed.enemies[0]?.skills[0]?.name).toBe("猛斩");
  });
});
