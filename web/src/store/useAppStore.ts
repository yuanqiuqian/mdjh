import { create } from "zustand";
import { createNewSave, applyStoryResponse, applyTraining, makeId } from "@/features/game/engine";
import { trainingActions } from "@/data/game-data";
import {
  clearLlmConfig,
  deleteSaveEntry,
  getLlmConfig,
  listSaveEntries,
  putLlmConfig,
  putSaveEntry,
} from "@/services/db";
import { requestStoryFromModel } from "@/services/llm";
import type { LlmConfig, SaveEntry, SaveSlot } from "@/types/game";

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
  lastStoryError: string | null;
  saveEntries: SaveEntry[];
  activeSave: SaveSlot | null;
  currentPanel: "overview" | "character" | "inventory" | "relations" | "logs";
  setCurrentPanel: (panel: AppState["currentPanel"]) => void;
  setOnline: (isOnline: boolean) => void;
  hydrate: () => Promise<void>;
  setValidation: (validation: ValidationState) => void;
  saveLlmConfig: (config: LlmConfig) => Promise<void>;
  clearConfig: () => Promise<void>;
  createGame: (sectId: string) => Promise<void>;
  applyOfflineTraining: (actionId: string) => Promise<void>;
  appendNote: (note: string) => Promise<void>;
  progressStory: (input: string) => Promise<void>;
  saveToSlot: (slotId: string) => Promise<void>;
  loadFromSlot: (slotId: string) => Promise<void>;
  clearSlot: (slotId: string) => Promise<void>;
};

const writeSaveEntries = async (entries: SaveEntry[]) => {
  await Promise.all(entries.map((entry) => putSaveEntry(entry)));
};

export const useAppStore = create<AppState>((set, get) => ({
  isHydrated: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  llmConfig: null,
  validation: { status: "idle", message: "尚未测试模型连接。" },
  isGenerating: false,
  lastStoryError: null,
  saveEntries: createInitialEntries(),
  activeSave: null,
  currentPanel: "overview",
  setCurrentPanel: (panel) => set({ currentPanel: panel }),
  setOnline: (isOnline) => set({ isOnline }),
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
      currentPanel: "overview",
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
      outcome: "这段记忆被你收进卷册。",
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
    if (!trimmed || !state.activeSave || !state.llmConfig || !configReady) {
      return;
    }

    set({ isGenerating: true, lastStoryError: null });

    try {
      const story = await requestStoryFromModel({
        config: state.llmConfig,
        save: state.activeSave,
        userInput: trimmed,
      });
      const updated = applyStoryResponse(state.activeSave, trimmed, story);
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
        lastStoryError: null,
      });
    } catch (error) {
      set({
        isGenerating: false,
        lastStoryError:
          error instanceof Error ? error.message : "剧情请求失败，请稍后重试。",
      });
    }
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

