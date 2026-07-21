import { create } from "zustand";
import {
  applyStoryResponse,
  applyTraining,
  beginCombat,
  buildCombatFollowupPrompt,
  createNewSave,
  getOfflineTrainingStatus,
  makeId,
  resolveCombatAction,
} from "@/features/game/engine";
import { trainingActions } from "@/data/game-data";
import {
  clearLlmConfig,
  deleteSaveEntry,
  getLlmConfig,
  listSaveEntries,
  putLlmConfig,
  putSaveEntry,
} from "@/services/db";
import { requestCombatSetupFromModel, requestStoryFromModel } from "@/services/llm";
import type {
  CombatActionInput,
  CombatSetupResponse,
  LlmConfig,
  SaveEntry,
  SaveSlot,
  StoryDebugInfo,
} from "@/types/game";

const createInitialEntries = (): SaveEntry[] => [
  { id: "active", kind: "active", label: "当前进度", data: null },
  { id: "recent-stable", kind: "stable", label: "最近稳定点", data: null },
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `manual-${index + 1}`,
    kind: "manual" as const,
    label: `手动存档 ${index + 1}`,
    data: null,
  })),
];

type ValidationState = {
  status: "idle" | "success" | "error";
  message: string;
  latencyMs?: number;
};

type AppState = {
  isHydrated: boolean;
  isOnline: boolean;
  llmConfig: LlmConfig | null;
  validation: ValidationState;
  isGenerating: boolean;
  debugMode: boolean;
  currentStoryRequest: string | null;
  lastStoryDebug: StoryDebugInfo | null;
  lastStoryError: string | null;
  saveEntries: SaveEntry[];
  activeSave: SaveSlot | null;
  setOnline: (isOnline: boolean) => void;
  setDebugMode: (enabled: boolean) => void;
  hydrate: () => Promise<void>;
  setValidation: (validation: ValidationState) => void;
  saveLlmConfig: (config: LlmConfig) => Promise<void>;
  clearConfig: () => Promise<void>;
  createGame: (sectId: string) => Promise<void>;
  applyOfflineTraining: (actionId: string) => Promise<void>;
  appendNote: (note: string) => Promise<void>;
  progressStory: (input: string) => Promise<void>;
  performCombatAction: (action: CombatActionInput) => Promise<void>;
  saveToSlot: (slotId: string) => Promise<void>;
  loadFromSlot: (slotId: string) => Promise<void>;
  clearSlot: (slotId: string) => Promise<void>;
};

const writeSaveEntries = async (entries: SaveEntry[]) => {
  await Promise.all(entries.map((entry) => putSaveEntry(entry)));
};

const buildFallbackCombatSetup = (save: SaveSlot, reason: string): CombatSetupResponse => ({
  title: "青石古道恶斗",
  objective: "击退拦路山贼，保住自己与路人。",
  introNarrative: reason || "对方率先拔刀，古道上的局势骤然升级为正面厮杀。",
  canFlee: true,
  allies: [],
  enemies: [
    {
      id: "npc-bandit",
      name: "山贼首领",
      side: "enemy",
      level: Math.max(1, save.player.stats.level + 1),
      hp: 136,
      hpMax: 136,
      mp: 24,
      mpMax: 24,
      atk: 22,
      arm: 8,
      aspd: 0.94,
      isBoss: true,
      skills: [
        {
          id: "bandit-cleave",
          name: "横刀猛斩",
          description: "抡起大刀猛力劈砍。",
          mpCost: 6,
          power: 22,
          target: "enemy",
          kind: "damage",
        },
      ],
    },
    {
      id: "bandit-goon-1",
      name: "山贼喽啰",
      side: "enemy",
      level: save.player.stats.level,
      hp: 84,
      hpMax: 84,
      mp: 0,
      mpMax: 0,
      atk: 15,
      arm: 5,
      aspd: 1.02,
      skills: [],
    },
  ],
});

export const useAppStore = create<AppState>((set, get) => ({
  isHydrated: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  llmConfig: null,
  validation: { status: "idle", message: "尚未测试模型连接。" },
  isGenerating: false,
  debugMode: false,
  currentStoryRequest: null,
  lastStoryDebug: null,
  lastStoryError: null,
  saveEntries: createInitialEntries(),
  activeSave: null,
  setOnline: (isOnline) => set({ isOnline }),
  setDebugMode: (debugMode) => set({ debugMode }),
  hydrate: async () => {
    const [savedConfig, savedEntries] = await Promise.all([
      getLlmConfig(),
      listSaveEntries(),
    ]);

    const fallback = createInitialEntries();
    const merged = fallback.map((entry) => {
      const saved = savedEntries.find((item) => item.id === entry.id);
      return saved ?? entry;
    });
    const active = merged.find((entry) => entry.id === "active")?.data ?? null;

    set({
      isHydrated: true,
      llmConfig: savedConfig,
      validation: savedConfig?.lastValidatedAt
        ? {
            status: "success",
            message: "已读取本机已验证的模型配置。",
          }
        : { status: "idle", message: "尚未测试模型连接。" },
      saveEntries: merged,
      activeSave: active,
      currentStoryRequest: null,
      lastStoryError: null,
    });
  },
  setValidation: (validation) => set({ validation }),
  saveLlmConfig: async (config) => {
    if (config.rememberOnDevice) {
      await putLlmConfig(config);
    } else {
      await clearLlmConfig();
    }
    set({ llmConfig: config });
  },
  clearConfig: async () => {
    await clearLlmConfig();
    set({
      llmConfig: null,
      validation: { status: "idle", message: "模型配置已清除。" },
      currentStoryRequest: null,
      lastStoryDebug: null,
      lastStoryError: null,
    });
  },
  createGame: async (sectId) => {
    const save = createNewSave(sectId);
    const nextEntries = get().saveEntries.map((entry) => {
      if (entry.id === "active" || entry.id === "recent-stable") {
        return { ...entry, data: save };
      }
      return entry;
    });
    await writeSaveEntries(nextEntries);
    set({
      activeSave: save,
      saveEntries: nextEntries,
      currentStoryRequest: null,
      lastStoryDebug: null,
      lastStoryError: null,
    });
  },
  applyOfflineTraining: async (actionId) => {
    const state = get();
    if (!state.activeSave) {
      return;
    }
    const action = trainingActions.find((item) => item.id === actionId);
    if (!action) {
      return;
    }
    const trainingStatus = getOfflineTrainingStatus(state.activeSave);
    if (trainingStatus.needsStoryAdvance) {
      set({
        lastStoryError: "本地修行已达本幕上限。请先推进剧情，再决定是否继续闭关。",
      });
      return;
    }
    if (trainingStatus.usedActionLabels.has(action.label)) {
      set({
        lastStoryError: `本幕中已经进行过一次“${action.label}”。请换一种修行，或先推进剧情。`,
      });
      return;
    }
    const { updated } = applyTraining(state.activeSave, action);
    const nextEntries = state.saveEntries.map((entry) => {
      if (entry.id === "active" || entry.id === "recent-stable") {
        return { ...entry, data: updated };
      }
      return entry;
    });
    await writeSaveEntries(nextEntries);
    set({
      activeSave: updated,
      saveEntries: nextEntries,
      currentStoryRequest: null,
      lastStoryError: null,
    });
  },
  appendNote: async (note) => {
    const state = get();
    if (!state.activeSave) {
      return;
    }
    const trimmed = note.trim();
    if (!trimmed) {
      return;
    }
    const event = {
      id: makeId("evt"),
      timestamp: new Date().toISOString(),
      sceneType: "system" as const,
      title: "随手记",
      narrative: trimmed,
      outcome: "这段记忆已写入当前存档记录。",
    };
    const updated: SaveSlot = {
      ...state.activeSave,
      updatedAt: new Date().toISOString(),
      recentEvents: [event, ...state.activeSave.recentEvents].slice(0, 50),
      longSummary: [...state.activeSave.longSummary].slice(-12),
    };
    const nextEntries = state.saveEntries.map((entry) => {
      if (entry.id === "active" || entry.id === "recent-stable") {
        return { ...entry, data: updated };
      }
      return entry;
    });
    await writeSaveEntries(nextEntries);
    set({ activeSave: updated, saveEntries: nextEntries, lastStoryError: null });
  },
  progressStory: async (input) => {
    const state = get();
    const trimmed = input.trim();
    const configReady =
      Boolean(state.llmConfig?.lastValidatedAt) && state.validation.status === "success";
    if (
      !trimmed ||
      !state.activeSave ||
      state.activeSave.gameMode !== "dialogue" ||
      !state.llmConfig ||
      !configReady
    ) {
      return;
    }

    set({
      isGenerating: true,
      currentStoryRequest: trimmed,
      lastStoryError: null,
      lastStoryDebug: {
        requestedAt: new Date().toISOString(),
        userInput: trimmed,
        requestUrl: "",
        requestBody: "",
        transport: "sse",
        fallbackUsed: false,
        finishReason: null,
        narrativePreview: null,
        rawPayload: null,
        rawContent: null,
        parsedStory: null,
        errorMessage: null,
      },
    });

    try {
      const { story, debug } = await requestStoryFromModel({
        config: state.llmConfig,
        save: state.activeSave,
        userInput: trimmed,
        onProgress: (progressDebug) => {
          set({ lastStoryDebug: progressDebug });
        },
      });
      let updated = applyStoryResponse(state.activeSave, trimmed, story);
      if (story.directives?.mode_transition?.to === "combat") {
        let combatSetup: CombatSetupResponse;
        try {
          combatSetup = await requestCombatSetupFromModel({
            config: state.llmConfig,
            save: updated,
            transitionReason: story.directives.mode_transition.reason,
          });
          if (combatSetup.enemies.length === 0) {
            combatSetup = buildFallbackCombatSetup(
              updated,
              story.directives.mode_transition.reason,
            );
          }
        } catch {
          combatSetup = buildFallbackCombatSetup(
            updated,
            story.directives.mode_transition.reason,
          );
        }
        updated = beginCombat(updated, combatSetup);
      }
      const nextEntries = state.saveEntries.map((entry) => {
        if (entry.id === "active" || entry.id === "recent-stable") {
          return { ...entry, data: updated };
        }
        return entry;
      });
      await writeSaveEntries(nextEntries);
      set({
        activeSave: updated,
        saveEntries: nextEntries,
        isGenerating: false,
        currentStoryRequest: null,
        lastStoryDebug: debug,
        lastStoryError: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "剧情请求失败，请稍后重试。";
      const debugInfo =
        error instanceof Error && "debugInfo" in error
          ? (error.debugInfo as StoryDebugInfo | undefined)
          : undefined;
      set({
        isGenerating: false,
        currentStoryRequest: null,
        lastStoryDebug:
          debugInfo ??
          {
            requestedAt: new Date().toISOString(),
            userInput: trimmed,
            requestUrl: state.llmConfig.endpoint,
            requestBody: "",
            transport: "json",
            fallbackUsed: false,
            finishReason: null,
            narrativePreview: null,
            rawPayload: null,
            rawContent: null,
            parsedStory: null,
            errorMessage: message,
          },
        lastStoryError: message,
      });
    }
  },
  performCombatAction: async (action) => {
    const state = get();
    if (!state.activeSave || state.activeSave.gameMode !== "combat" || !state.activeSave.combatState) {
      return;
    }
    const resolution = resolveCombatAction(state.activeSave, action);
    let updatedSave = resolution.updatedSave;

    const configReady =
      Boolean(state.llmConfig?.lastValidatedAt) && state.validation.status === "success";

    if (
      resolution.finished &&
      resolution.result &&
      resolution.result !== "defeat" &&
      state.llmConfig &&
      state.isOnline &&
      configReady
    ) {
      const followupPrompt = buildCombatFollowupPrompt(updatedSave, resolution.result);
      set({
        isGenerating: true,
        currentStoryRequest: followupPrompt,
        lastStoryError: null,
      });
      try {
        const { story, debug } = await requestStoryFromModel({
          config: state.llmConfig,
          save: updatedSave,
          userInput: followupPrompt,
          onProgress: (progressDebug) => {
            set({ lastStoryDebug: progressDebug });
          },
        });
        updatedSave = applyStoryResponse(updatedSave, followupPrompt, story);
        if (story.directives?.mode_transition?.to === "combat") {
          let combatSetup: CombatSetupResponse;
          try {
            combatSetup = await requestCombatSetupFromModel({
              config: state.llmConfig,
              save: updatedSave,
              transitionReason: story.directives.mode_transition.reason,
            });
            if (combatSetup.enemies.length === 0) {
              combatSetup = buildFallbackCombatSetup(
                updatedSave,
                story.directives.mode_transition.reason,
              );
            }
          } catch {
            combatSetup = buildFallbackCombatSetup(
              updatedSave,
              story.directives.mode_transition.reason,
            );
          }
          updatedSave = beginCombat(updatedSave, combatSetup);
        }
        set({
          isGenerating: false,
          currentStoryRequest: null,
          lastStoryDebug: debug,
          lastStoryError: null,
        });
      } catch (error) {
        set({
          isGenerating: false,
          currentStoryRequest: null,
          lastStoryError:
            error instanceof Error ? error.message : "战后剧情续写失败，请稍后重试。",
        });
      }
    }

    const nextEntries = state.saveEntries.map((entry) => {
      if (entry.id === "active" || entry.id === "recent-stable") {
        return { ...entry, data: updatedSave };
      }
      return entry;
    });
    await writeSaveEntries(nextEntries);
    set({
      activeSave: updatedSave,
      saveEntries: nextEntries,
    });
  },
  saveToSlot: async (slotId) => {
    const state = get();
    if (!state.activeSave) {
      return;
    }
    const snapshot = {
      ...state.activeSave,
      updatedAt: new Date().toISOString(),
      name: slotId === "recent-stable" ? "最近稳定点" : `存档 ${slotId.split("-").pop()}`,
    };
    const nextEntries = state.saveEntries.map((entry) =>
      entry.id === slotId ? { ...entry, data: snapshot } : entry,
    );
    await writeSaveEntries(nextEntries);
    set({ saveEntries: nextEntries });
  },
  loadFromSlot: async (slotId) => {
    const state = get();
    const target = state.saveEntries.find((entry) => entry.id === slotId)?.data;
    if (!target) {
      return;
    }
    const nextEntries = state.saveEntries.map((entry) =>
      entry.id === "active" ? { ...entry, data: { ...target, slotId: "active" } } : entry,
    );
    await writeSaveEntries(nextEntries);
    set({
      activeSave: { ...target, slotId: "active" },
      saveEntries: nextEntries,
    });
  },
  clearSlot: async (slotId) => {
    const state = get();
    const nextEntries = state.saveEntries.map((entry) =>
      entry.id === slotId ? { ...entry, data: null } : entry,
    );
    const target = nextEntries.find((entry) => entry.id === slotId);
    if (target) {
      await putSaveEntry(target);
    } else {
      await deleteSaveEntry(slotId);
    }
    set({ saveEntries: nextEntries });
  },
}));
