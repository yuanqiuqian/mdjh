import type {
  LlmConfig,
  SaveSlot,
  StoryResponse,
  ValidateLlmConfigInput,
  ValidateLlmConfigResult,
} from "@/types/game";

const classifyError = (status: number) => {
  if (status === 401 || status === 403) {
    return "鉴权失败，请检查 api_key 或接口权限。";
  }
  if (status === 404) {
    return "接口地址或模型标识无效，请检查 endpoint 与 model_id。";
  }
  if (status === 429) {
    return "当前账号已触发额度或频率限制，请稍后重试。";
  }
  if (status >= 500) {
    return "模型服务暂时不可用，请稍后再试。";
  }
  return "请求已发出，但服务未返回可判定的成功结果。";
};

export const buildChatCompletionsUrl = (endpoint: string) => {
  const url = new URL(endpoint);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/chat/completions")) {
    return url.toString();
  }

  if (!pathname || pathname === "/") {
    url.pathname = "/v1/chat/completions";
    return url.toString();
  }

  if (pathname.endsWith("/v1")) {
    url.pathname = `${pathname}/chat/completions`;
    return url.toString();
  }

  url.pathname = `${pathname}/chat/completions`;
  return url.toString();
};

const getErrorText = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }
  } catch {
  }
  return classifyError(response.status);
};

export const validateLlmConfig = async ({
  endpoint,
  modelId,
  apiKey,
}: ValidateLlmConfigInput): Promise<ValidateLlmConfigResult> => {
  const startedAt = performance.now();

  if (!navigator.onLine) {
    return {
      success: false,
      latencyMs: 0,
      message: "当前处于离线状态，无法执行模型连接测试。",
    };
  }

  try {
    const url = new URL(buildChatCompletionsUrl(endpoint));
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return {
        success: false,
        latencyMs: 0,
        message: "生产环境建议使用 HTTPS 接口地址。",
      };
    }
  } catch {
    return {
      success: false,
      latencyMs: 0,
      message: "endpoint 格式无效，请填写完整可访问地址。",
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(buildChatCompletionsUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - startedAt);
    window.clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        latencyMs,
        message: `连接测试通过，模型 ${modelId} 已返回可用响应。`,
      };
    }

    return {
      success: false,
      latencyMs,
      message: await getErrorText(response),
    };
  } catch (error) {
    window.clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startedAt);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      latencyMs,
      message: isAbort
        ? "请求超时，请检查 endpoint 可达性或稍后重试。"
        : "无法连接到模型服务，请检查网络、跨域设置或接口地址。",
    };
  }
};

const buildContextPacket = (save: SaveSlot, currentPrompt: string) => ({
  rules: [
    "你是武侠江湖对话型文字游戏的叙事引擎。",
    "必须输出合法 JSON，不要输出 JSON 之外的解释。",
    "不得修改存档中未被本轮事件解释的关键资源。",
    "所有状态变化都必须小幅、合理、可追溯。",
  ],
  player_state: {
    name: save.player.name,
    title: save.player.title,
    location: save.player.location,
    sect_id: save.player.sectId,
    personality_summary: save.player.personalitySummary,
    money: save.player.money,
    stats: save.player.stats,
  },
  known_characters: save.relations.slice(0, 8).map((item) => ({
    id: item.id,
    name: item.name,
    favor: item.favor,
    note: item.note,
  })),
  long_summary: save.longSummary.slice(-8),
  recent_events: save.recentEvents.slice(0, 8).map((event) => ({
    scene_type: event.sceneType,
    title: event.title,
    narrative: event.narrative,
    outcome: event.outcome,
    deltas: event.deltas,
  })),
  current_prompt: currentPrompt,
});

const storySystemPrompt = `
你正在为武侠对话文字游戏生成下一段剧情。
请严格返回 JSON，格式如下：
{
  "narrative": "面向玩家的叙事文本，允许换行",
  "directives": {
    "next_options": [
      { "label": "选项标题", "hint": "简短提示", "risk": "风险提示，可选" }
    ],
    "suggested_deltas": {
      "hp_delta": 0,
      "mp_delta": 0,
      "exp_delta": 0,
      "money_delta": 0
    },
    "hooks": ["后续伏笔"]
  }
}
要求：
1. narrative 必须是中文。
2. next_options 提供 2 到 4 个。
3. 数值变化保持小幅合理，默认在 -20 到 +20 区间内。
4. 不要输出 markdown 代码块，不要解释。
`.trim();

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
};

const extractContent = (payload: unknown) => {
  const record = getRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const firstChoice = getRecord(choices[0]);
  const message = getRecord(firstChoice?.message);
  const raw = message?.content;
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        const node = getRecord(item);
        return typeof node?.text === "string" ? node.text : "";
      })
      .join("");
  }
  return "";
};

const extractJson = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return content.slice(start, end + 1);
  }
  return content.trim();
};

const clampDelta = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(-20, Math.min(20, Math.round(value)));
};

export const parseStoryResponse = (content: string): StoryResponse => {
  const json = extractJson(content);
  const parsed = JSON.parse(json) as unknown;
  const root = getRecord(parsed);
  const directives = getRecord(root?.directives);
  const suggestedDeltas = getRecord(directives?.suggested_deltas);

  const narrative =
    typeof root?.narrative === "string" && root.narrative.trim()
      ? root.narrative.trim()
      : "风声掠过林梢，这一刻的江湖没有给出清晰回应。";

  const nextOptionSource = Array.isArray(directives?.next_options)
    ? directives.next_options
    : [];

  const nextOptions = nextOptionSource
    .map((item) => getRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.label === "string" && item.label.trim())
    .slice(0, 4)
    .map((item) => ({
      label: (item.label as string).trim(),
      hint: typeof item.hint === "string" ? item.hint.trim() : undefined,
      risk: typeof item.risk === "string" ? item.risk.trim() : undefined,
    }));

  const hookSource = Array.isArray(directives?.hooks) ? directives.hooks : [];

  return {
    narrative,
    directives: {
      next_options: nextOptions,
      suggested_deltas: {
        hp_delta: clampDelta(
          typeof suggestedDeltas?.hp_delta === "number" ? suggestedDeltas.hp_delta : undefined,
        ),
        mp_delta: clampDelta(
          typeof suggestedDeltas?.mp_delta === "number" ? suggestedDeltas.mp_delta : undefined,
        ),
        exp_delta: clampDelta(
          typeof suggestedDeltas?.exp_delta === "number" ? suggestedDeltas.exp_delta : undefined,
        ),
        money_delta: clampDelta(
          typeof suggestedDeltas?.money_delta === "number" ? suggestedDeltas.money_delta : undefined,
        ),
      },
      hooks: hookSource
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 4),
    },
  };
};

export const requestStoryFromModel = async ({
  config,
  save,
  userInput,
}: {
  config: LlmConfig;
  save: SaveSlot;
  userInput: string;
}): Promise<StoryResponse> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(buildChatCompletionsUrl(config.endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelId,
        temperature: 0.9,
        max_tokens: 800,
        messages: [
          { role: "system", content: storySystemPrompt },
          {
            role: "user",
            content: JSON.stringify(buildContextPacket(save, userInput)),
          },
        ],
      }),
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(await getErrorText(response));
    }

    const payload = await response.json();
    const content = extractContent(payload);
    if (!content.trim()) {
      throw new Error("模型返回为空，无法生成剧情。");
    }
    return parseStoryResponse(content);
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("剧情请求失败，请稍后重试。");
  }
};

export const redactApiKey = (value: string) => {
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
};
