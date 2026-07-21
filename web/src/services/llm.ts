import type {
  CombatSetupResponse,
  Combatant,
  LlmConfig,
  SaveSlot,
  StoryDebugInfo,
  StoryResponse,
  ValidateLlmConfigInput,
  ValidateLlmConfigResult,
} from "@/types/game";

type StoryRequestError = Error & {
  debugInfo?: StoryDebugInfo;
};

type StoryRequestPayload = {
  model: string;
  temperature: number;
  max_tokens: number;
  stream?: boolean;
  messages: Array<{ role: "system" | "user"; content: string }>;
};

type StoryRequestProgress = {
  rawContent: string;
  rawPayload: string;
  preview: string | null;
  finishReason: string | null;
};

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

/**
 * Builds the request payload shared by both standard and streaming story calls.
 */
const buildStoryRequestPayload = (
  config: LlmConfig,
  save: SaveSlot,
  userInput: string,
  stream: boolean,
): StoryRequestPayload => ({
  model: config.modelId,
  temperature: 0.9,
  max_tokens: 1200,
  stream,
  messages: [
    { role: "system", content: storySystemPrompt },
    {
      role: "user",
      content: JSON.stringify(buildContextPacket(save, userInput)),
    },
  ],
});

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
    "平时以对话模式推进剧情；当发生明确攻击、围杀、追击、拔刀冲突时，可切换到 combat 模式。",
  ],
  game_mode: save.gameMode,
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
  active_combat:
    save.gameMode === "combat" && save.combatState
      ? {
          title: save.combatState.title,
          objective: save.combatState.objective,
          round: save.combatState.round,
          player_hp: save.combatState.player.hp,
          player_mp: save.combatState.player.mp,
          alive_enemies: save.combatState.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => ({
            id: enemy.id,
            name: enemy.name,
            hp: enemy.hp,
            hpMax: enemy.hpMax,
          })),
          recent_logs: save.combatState.logs.slice(-5).map((log) => log.summary),
        }
      : null,
  current_prompt: currentPrompt,
});

const storySystemPrompt = `
你正在为武侠对话文字游戏生成下一段剧情。
请严格返回 JSON，格式如下：
{
  "narrative": "面向玩家的叙事文本，允许换行",
  "directives": {
    "scene_type": "dialogue 或 combat",
    "next_options": [
      { "label": "选项标题", "hint": "简短提示", "risk": "风险提示，可选" }
    ],
    "suggested_deltas": {
      "hp_delta": 0,
      "mp_delta": 0,
      "exp_delta": 0,
      "money_delta": 0
    },
    "hooks": ["后续伏笔"],
    "mode_transition": {
      "to": "dialogue 或 combat",
      "reason": "触发原因"
    },
    "combat_hint": {
      "title": "战斗标题",
      "objective": "战斗目标",
      "can_flee": true
    }
  }
}
要求：
1. narrative 必须是中文。
2. next_options 提供 2 到 4 个。
3. 数值变化保持小幅合理，默认在 -20 到 +20 区间内。
4. 当玩家输入表现出明确攻击、击杀、拔刀、追击意图，且局势合理时，应切换到 combat 模式，而不是继续长时间对话拉扯。
5. 如果本回合仍处于普通对话，则 mode_transition.to 保持为 dialogue。
6. 不要输出 markdown 代码块，不要解释。
`.trim();

const combatSetupSystemPrompt = `
你正在为武侠江湖文字游戏初始化一场回合制战斗。
请严格返回 JSON，格式如下：
{
  "title": "战斗标题",
  "objective": "战斗目标",
  "introNarrative": "战斗开始前的简短描述",
  "canFlee": true,
  "allies": [],
  "enemies": [
    {
      "id": "enemy_id",
      "name": "敌人名称",
      "side": "enemy",
      "level": 1,
      "hp": 100,
      "hpMax": 100,
      "mp": 20,
      "mpMax": 20,
      "atk": 18,
      "arm": 6,
      "aspd": 1,
      "isBoss": false,
      "skills": [
        {
          "id": "skill_id",
          "name": "技能名",
          "description": "技能说明",
          "mpCost": 0,
          "power": 20,
          "target": "enemy",
          "kind": "damage"
        }
      ]
    }
  ]
}
要求：
1. 返回 1 到 3 个 enemies，必要时可包含 0 到 1 个 allies。
2. 数值为初期战斗合理范围：普通敌人 hp 60-140，boss hp 120-220，atk 12-28，arm 4-12。
3. 技能保持简洁，1 到 2 个即可。
4. 不要输出解释，不要输出 markdown。
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

/**
 * Extracts incremental text content from a streamed chat-completions chunk.
 */
const extractStreamDeltaContent = (payload: unknown) => {
  const record = getRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const firstChoice = getRecord(choices[0]);
  const delta = getRecord(firstChoice?.delta);
  const raw = delta?.content;

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

/**
 * Extracts the provider finish reason from a streamed chunk when available.
 */
const extractFinishReason = (payload: unknown) => {
  const record = getRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const firstChoice = getRecord(choices[0]);
  return typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : null;
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

/**
 * Pulls a readable narrative preview from a partially streamed JSON string.
 */
export const extractNarrativePreview = (content: string) => {
  const marker = '"narrative"';
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) {
    return "";
  }

  const colonIndex = content.indexOf(":", markerIndex + marker.length);
  if (colonIndex < 0) {
    return "";
  }

  const quoteIndex = content.indexOf('"', colonIndex);
  if (quoteIndex < 0) {
    return "";
  }

  let escaped = false;
  let preview = "";

  for (let index = quoteIndex + 1; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      if (char === "n") {
        preview += "\n";
      } else if (char === "t") {
        preview += "\t";
      } else if (char === "r") {
        preview += "\r";
      } else {
        preview += char;
      }
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      break;
    }
    preview += char;
  }

  return preview.trim();
};

/**
 * Consumes an SSE response body and emits incremental story content updates.
 */
const readSseStoryStream = async (
  response: Response,
  onProgress?: (progress: StoryRequestProgress) => void,
) => {
  if (!response.body) {
    throw new Error("当前模型接口未提供可读取的流式响应。");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  const rawEvents: string[] = [];
  let buffer = "";
  let rawContent = "";
  let done = false;
  let finishReason: string | null = null;

  const emitProgress = () => {
    onProgress?.({
      rawContent,
      rawPayload: rawEvents.join("\n"),
      preview: extractNarrativePreview(rawContent) || null,
      finishReason,
    });
  };

  const processBlock = (block: string) => {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      return;
    }

    const data = dataLines.join("\n");
    if (data === "[DONE]") {
      done = true;
      return;
    }

    rawEvents.push(data);

    try {
      const payload = JSON.parse(data) as unknown;
      finishReason = extractFinishReason(payload) ?? finishReason;
      const delta = extractStreamDeltaContent(payload);
      if (delta) {
        rawContent += delta;
        emitProgress();
      } else if (finishReason) {
        emitProgress();
      }
    } catch {
      rawContent += data;
      emitProgress();
    }
  };

  while (!done) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + 2);
      if (block) {
        processBlock(block);
      }
      if (done) {
        break;
      }
      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  const tail = buffer.trim();
  if (!done && tail) {
    processBlock(tail);
  }

  return {
    rawContent,
    rawPayload: rawEvents.join("\n"),
    preview: extractNarrativePreview(rawContent) || null,
    finishReason,
  };
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
  const modeTransition = getRecord(directives?.mode_transition);
  const combatHint = getRecord(directives?.combat_hint);

  return {
    narrative,
    directives: {
      scene_type:
        directives?.scene_type === "combat"
          ? "combat"
          : "dialogue",
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
      mode_transition:
        modeTransition?.to === "combat" || modeTransition?.to === "dialogue"
          ? {
              to: modeTransition.to,
              reason:
                typeof modeTransition.reason === "string" && modeTransition.reason.trim()
                  ? modeTransition.reason.trim()
                  : modeTransition.to === "combat"
                    ? "局势升级为交战。"
                    : "剧情继续处于对话阶段。",
            }
          : undefined,
      combat_hint: combatHint
        ? {
            title:
              typeof combatHint.title === "string" && combatHint.title.trim()
                ? combatHint.title.trim()
                : undefined,
            objective:
              typeof combatHint.objective === "string" && combatHint.objective.trim()
                ? combatHint.objective.trim()
                : undefined,
            can_flee: Boolean(combatHint.can_flee),
          }
        : undefined,
    },
  };
};

const parseCombatantList = (value: unknown, side: Combatant["side"]): Combatant[] => {
  if (!Array.isArray(value)) {
    return [] as Combatant[];
  }

  return value
    .map((item) => getRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.id === "string" && typeof item.name === "string")
    .slice(0, side === "enemy" ? 3 : 1)
    .map((item) => {
      const skillsSource = Array.isArray(item.skills) ? item.skills : [];
      return {
        id: item.id as string,
        name: item.name as string,
        side,
        level: typeof item.level === "number" ? Math.max(1, Math.round(item.level)) : 1,
        hp: typeof item.hp === "number" ? Math.max(1, Math.round(item.hp)) : 90,
        hpMax: typeof item.hpMax === "number" ? Math.max(1, Math.round(item.hpMax)) : typeof item.hp === "number" ? Math.max(1, Math.round(item.hp)) : 90,
        mp: typeof item.mp === "number" ? Math.max(0, Math.round(item.mp)) : 0,
        mpMax: typeof item.mpMax === "number" ? Math.max(0, Math.round(item.mpMax)) : typeof item.mp === "number" ? Math.max(0, Math.round(item.mp)) : 0,
        atk: typeof item.atk === "number" ? Math.max(8, Math.round(item.atk)) : 16,
        arm: typeof item.arm === "number" ? Math.max(0, Math.round(item.arm)) : 6,
        aspd: typeof item.aspd === "number" ? Math.max(0.6, Number(item.aspd.toFixed(2))) : 1,
        isBoss: Boolean(item.isBoss),
        skills: skillsSource
          .map((skill) => getRecord(skill))
          .filter((skill): skill is Record<string, unknown> => Boolean(skill))
          .filter((skill) => typeof skill.id === "string" && typeof skill.name === "string")
          .slice(0, 2)
          .map((skill) => ({
            id: skill.id as string,
            name: skill.name as string,
            description:
              typeof skill.description === "string" && skill.description.trim()
                ? skill.description.trim()
                : "战斗技能",
            mpCost: typeof skill.mpCost === "number" ? Math.max(0, Math.round(skill.mpCost)) : 0,
            power: typeof skill.power === "number" ? Math.max(1, Math.round(skill.power)) : 16,
            target: (skill.target === "self" ? "self" : "enemy") as "self" | "enemy",
            kind: (skill.kind === "recover" ? "recover" : "damage") as "recover" | "damage",
          })),
      };
    });
};

export const parseCombatSetupResponse = (content: string): CombatSetupResponse => {
  const json = extractJson(content);
  const parsed = JSON.parse(json) as unknown;
  const root = getRecord(parsed);
  const enemies = parseCombatantList(root?.enemies, "enemy");
  const allies = parseCombatantList(root?.allies, "ally");

  return {
    title:
      typeof root?.title === "string" && root.title.trim()
        ? root.title.trim()
        : "突发交战",
    objective:
      typeof root?.objective === "string" && root.objective.trim()
        ? root.objective.trim()
        : "击退当前敌人并活下来。",
    introNarrative:
      typeof root?.introNarrative === "string" && root.introNarrative.trim()
        ? root.introNarrative.trim()
        : "双方气机骤然绷紧，转眼便到了拔刀相向的地步。",
    canFlee: root?.canFlee !== false,
    allies,
    enemies,
  };
};

/**
 * Performs a non-stream fallback request and returns the full extracted response text.
 */
const requestStoryFromModelAsJson = async ({
  config,
  save,
  userInput,
  signal,
}: {
  config: LlmConfig;
  save: SaveSlot;
  userInput: string;
  signal: AbortSignal;
}) => {
  const requestUrl = buildChatCompletionsUrl(config.endpoint);
  const requestBody = JSON.stringify(buildStoryRequestPayload(config, save, userInput, false));
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: requestBody,
    signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorText(response));
  }

  const payload = await response.json();
  return {
    requestBody,
    rawPayload: JSON.stringify(payload, null, 2),
    rawContent: extractContent(payload),
  };
};

export const requestCombatSetupFromModel = async ({
  config,
  save,
  transitionReason,
}: {
  config: LlmConfig;
  save: SaveSlot;
  transitionReason: string;
}): Promise<CombatSetupResponse> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(buildChatCompletionsUrl(config.endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelId,
        temperature: 0.4,
        max_tokens: 900,
        messages: [
          { role: "system", content: combatSetupSystemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              trigger_reason: transitionReason,
              player_state: {
                name: save.player.name,
                title: save.player.title,
                sect_id: save.player.sectId,
                stats: save.player.stats,
              },
              known_characters: save.relations.slice(0, 8),
              recent_events: save.recentEvents.slice(0, 8),
              long_summary: save.longSummary.slice(-6),
            }),
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
      throw new Error("模型未返回可用的战斗初始化数据。");
    }
    return parseCombatSetupResponse(content);
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("战斗初始化失败，请稍后重试。");
  }
};

/**
 * Requests the next story beat and supports SSE streaming previews when available.
 */
export const requestStoryFromModel = async ({
  config,
  save,
  userInput,
  onProgress,
}: {
  config: LlmConfig;
  save: SaveSlot;
  userInput: string;
  onProgress?: (debug: StoryDebugInfo) => void;
}): Promise<{ story: StoryResponse; debug: StoryDebugInfo }> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  const requestUrl = buildChatCompletionsUrl(config.endpoint);
  const requestPayload = buildStoryRequestPayload(config, save, userInput, true);
  const requestBody = JSON.stringify(requestPayload);
  const createDebugInfo = (
    overrides: Partial<StoryDebugInfo> = {},
  ): StoryDebugInfo => ({
    requestedAt: new Date().toISOString(),
    userInput,
    requestUrl,
    requestBody,
    transport: "sse",
    fallbackUsed: false,
    finishReason: null,
    narrativePreview: null,
    rawPayload: null,
    rawContent: null,
    parsedStory: null,
    errorMessage: null,
    ...overrides,
  });

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: requestBody,
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(await getErrorText(response));
    }

    let transport: StoryDebugInfo["transport"] = "json";
    let rawPayload: string | null = null;
    let content = "";
    let preview: string | null = null;
    let finishReason: string | null = null;
    let fallbackUsed = false;

    const contentType = response.headers.get("content-type") ?? "";

    if (response.body && contentType.includes("text/event-stream")) {
      transport = "sse";
      const streamResult = await readSseStoryStream(response, (progress) => {
        onProgress?.(
          createDebugInfo({
            transport: "sse",
            fallbackUsed: false,
            finishReason: progress.finishReason,
            narrativePreview: progress.preview,
            rawPayload: progress.rawPayload,
            rawContent: progress.rawContent,
          }),
        );
      });
      content = streamResult.rawContent;
      rawPayload = streamResult.rawPayload;
      preview = streamResult.preview;
      finishReason = streamResult.finishReason;
    } else {
      const payload = await response.json();
      content = extractContent(payload);
      rawPayload = JSON.stringify(payload, null, 2);
      preview = extractNarrativePreview(content) || null;
    }

    if (!content.trim()) {
      const error = new Error("模型返回为空，无法生成剧情。") as StoryRequestError;
      error.debugInfo = createDebugInfo({
        transport,
        narrativePreview: preview,
        rawPayload,
        rawContent: content,
        errorMessage: "模型返回为空，无法生成剧情。",
      });
      throw error;
    }
    let story: StoryResponse;
    try {
      story = parseStoryResponse(content);
    } catch (error) {
      if (transport === "sse") {
        const fallback = await requestStoryFromModelAsJson({
          config,
          save,
          userInput,
          signal: controller.signal,
        });
        content = fallback.rawContent;
        rawPayload = [
          rawPayload ? `SSE events:\n${rawPayload}` : null,
          `Fallback JSON payload:\n${fallback.rawPayload}`,
        ]
          .filter(Boolean)
          .join("\n\n");
        preview = extractNarrativePreview(content) || preview;
        fallbackUsed = true;
        story = parseStoryResponse(content);
      } else {
      const message =
        error instanceof Error ? error.message : "模型返回格式异常，无法解析剧情。";
      const parseError = new Error(message) as StoryRequestError;
      parseError.debugInfo = createDebugInfo({
        transport,
        fallbackUsed,
        finishReason,
        narrativePreview: preview,
        rawPayload,
        rawContent: content,
        errorMessage: message,
      });
      throw parseError;
      }
    }
    return {
      story,
      debug: createDebugInfo({
        transport,
        fallbackUsed,
        finishReason,
        narrativePreview: preview ?? story.narrative,
        rawPayload,
        rawContent: content,
        parsedStory: story,
        errorMessage: null,
      }),
    };
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
