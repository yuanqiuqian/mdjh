import { openDB } from "idb";
import type { LlmConfig, SaveEntry } from "@/types/game";

const DB_NAME = "mdjh-app";
const DB_VERSION = 1;
const SAVE_STORE = "save_slots";
const CONFIG_STORE = "llm_config";

const getDb = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SAVE_STORE)) {
        db.createObjectStore(SAVE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: "id" });
      }
    },
  });

export const listSaveEntries = async () => {
  const db = await getDb();
  return db.getAll(SAVE_STORE) as Promise<SaveEntry[]>;
};

export const putSaveEntry = async (entry: SaveEntry) => {
  const db = await getDb();
  await db.put(SAVE_STORE, entry);
};

export const deleteSaveEntry = async (id: string) => {
  const db = await getDb();
  await db.delete(SAVE_STORE, id);
};

export const getLlmConfig = async () => {
  const db = await getDb();
  const result = await db.get(CONFIG_STORE, "primary");
  return (result?.data ?? null) as LlmConfig | null;
};

export const putLlmConfig = async (config: LlmConfig) => {
  const db = await getDb();
  await db.put(CONFIG_STORE, { id: "primary", data: config });
};

export const clearLlmConfig = async () => {
  const db = await getDb();
  await db.delete(CONFIG_STORE, "primary");
};
