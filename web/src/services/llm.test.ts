import { describe, expect, it } from "vitest";
import { buildChatCompletionsUrl, parseStoryResponse } from "@/services/llm";

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
});

