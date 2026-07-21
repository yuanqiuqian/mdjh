import { Link } from "react-router-dom";
import { favorLabel, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { redactApiKey } from "@/services/llm";
import { useAppStore } from "@/store/useAppStore";
import type { SaveEntry } from "@/types/game";

export type GamePanelKey = "character" | "inventory" | "relations" | "logs" | "saves" | "system";

type SaveSlotsPanelProps = {
  onLoaded?: () => void;
};

type GamePanelContentProps = {
  panel: GamePanelKey;
  onOpenModelSettings: () => void;
  onLoaded?: () => void;
};

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

const exportPayload = (entries: SaveEntry[], llmConfig: ReturnType<typeof useAppStore.getState>["llmConfig"], includeKey: boolean) => {
  const config = llmConfig
    ? includeKey
      ? llmConfig
      : { ...llmConfig, apiKey: "" }
    : null;
  return {
    app: "mdjh",
    version: 1,
    exportedAt: new Date().toISOString(),
    saveEntries: entries,
    llmConfig: config,
  };
};

/**
 * Renders save slot operations and supports loading directly into the active story.
 */
export function SaveSlotsPanel({ onLoaded }: SaveSlotsPanelProps) {
  const activeSave = useAppStore((state) => state.activeSave);
  const saveEntries = useAppStore((state) => state.saveEntries);
  const saveToSlot = useAppStore((state) => state.saveToSlot);
  const loadFromSlot = useAppStore((state) => state.loadFromSlot);
  const clearSlot = useAppStore((state) => state.clearSlot);

  return (
    <div className="grid gap-2">
      {saveEntries.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
        >
          <div>
            <p className="text-sm text-stone-100">{entry.label}</p>
            <p className="mt-1 text-xs text-stone-500">
              {entry.data ? `${entry.data.player.title} · ${formatDateTime(entry.data.updatedAt)}` : "空"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {entry.id !== "active" ? (
              <button
                type="button"
                disabled={!entry.data}
                onClick={async () => {
                  if (!entry.data) {
                    return;
                  }
                  await loadFromSlot(entry.id);
                  onLoaded?.();
                }}
                className={cn(
                  "rounded-[14px] px-3 py-1.5 transition",
                  entry.data
                    ? "bg-white/5 text-stone-100 hover:bg-white/10"
                    : "bg-white/5 text-stone-500",
                )}
              >
                读取
              </button>
            ) : null}
            {entry.id !== "active" ? (
              <button
                type="button"
                disabled={!activeSave}
                onClick={() => saveToSlot(entry.id)}
                className={cn(
                  "rounded-[14px] px-3 py-1.5 transition",
                  activeSave
                    ? "bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                    : "bg-white/5 text-stone-500",
                )}
              >
                覆盖
              </button>
            ) : null}
            {entry.id !== "active" ? (
              <button
                type="button"
                onClick={() => clearSlot(entry.id)}
                className="rounded-[14px] bg-rose-500/10 px-3 py-1.5 text-rose-200 transition hover:bg-rose-500/20"
              >
                清空
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders one in-game utility panel inside a modal.
 */
export function GamePanelContent({
  panel,
  onOpenModelSettings,
  onLoaded,
}: GamePanelContentProps) {
  const activeSave = useAppStore((state) => state.activeSave);
  const saveEntries = useAppStore((state) => state.saveEntries);
  const llmConfig = useAppStore((state) => state.llmConfig);
  const validation = useAppStore((state) => state.validation);
  const configReady =
    Boolean(llmConfig?.lastValidatedAt) && validation.status === "success";

  if (!activeSave && panel !== "system" && panel !== "saves") {
    return <p className="text-sm text-stone-400">先开始新游戏，当前功能才会出现内容。</p>;
  }

  if (panel === "character" && activeSave) {
    return (
      <div className="grid gap-3 text-sm text-stone-300">
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs text-stone-500">身份</p>
          <p className="mt-1 text-sm text-stone-100">
            {activeSave.player.title} · 年龄 {activeSave.player.age}
          </p>
          <p className="mt-1 text-xs text-stone-500">所在地：{activeSave.player.location}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["等级", activeSave.player.stats.level],
            ["EXP", `${activeSave.player.stats.exp}/100`],
            ["攻击", activeSave.player.stats.atk],
            ["护甲", activeSave.player.stats.arm],
            ["攻速", activeSave.player.stats.aspd],
            ["银两", activeSave.player.money],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3"
            >
              <p className="text-xs text-stone-500">{label}</p>
              <p className="mt-1 text-sm text-stone-100">{String(value)}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs text-stone-500">性格与立场</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-200">
            {activeSave.player.personalitySummary}
          </p>
        </div>
      </div>
    );
  }

  if (panel === "inventory" && activeSave) {
    return (
      <div className="grid gap-2">
        {activeSave.inventory.length > 0 ? (
          activeSave.inventory.map((item) => (
            <div
              key={item.id}
              className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-stone-100">{item.name}</p>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-stone-400">
                  {item.type}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-400">{item.description}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-400">背包为空。</p>
        )}
      </div>
    );
  }

  if (panel === "relations" && activeSave) {
    return (
      <div className="grid gap-2">
        {activeSave.relations.length > 0 ? (
          activeSave.relations.map((relation) => (
            <div
              key={relation.id}
              className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-stone-100">{relation.name}</p>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-stone-400">
                  {favorLabel(relation.favor)} · {relation.favor}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-400">{relation.note}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-400">暂无记录。</p>
        )}
      </div>
    );
  }

  if (panel === "logs" && activeSave) {
    return (
      <div className="grid gap-2">
        {activeSave.recentEvents.slice(0, 24).map((event) => (
          <div
            key={event.id}
            className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stone-100">{event.title}</p>
                <p className="mt-1 text-[11px] text-stone-600">
                  {formatDateTime(event.timestamp)} · {event.sceneType}
                </p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-stone-300">
              {event.narrative}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-500">
              {event.outcome}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (panel === "saves") {
    return <SaveSlotsPanel onLoaded={onLoaded} />;
  }

  return (
    <div className="grid gap-4 text-sm text-stone-300">
      <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-xs text-stone-500">模型接入状态</p>
        {llmConfig ? (
          <div className="mt-3 grid gap-2">
            <p className="text-sm text-stone-100">{llmConfig.endpoint}</p>
            <p className="text-xs text-stone-500">
              {llmConfig.modelId} · {redactApiKey(llmConfig.apiKey)}
            </p>
            <p className="text-xs text-stone-500">
              状态：{configReady ? "已验证" : "未验证"} · {validation.message}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-400">尚未保存模型配置。</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenModelSettings}
            className="rounded-[16px] bg-white/5 px-3 py-1.5 text-xs text-stone-100 transition hover:bg-white/10"
          >
            打开模型设置
          </button>
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-xs text-stone-500">导出与备份</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              downloadJson("mdjh-export.json", exportPayload(saveEntries, llmConfig, false));
            }}
            className="rounded-[16px] bg-white/5 px-3 py-1.5 text-xs text-stone-100 transition hover:bg-white/10"
          >
            导出（不含 key）
          </button>
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm("导出包含 api_key 的文件存在泄露风险，确认继续？");
              if (!ok) return;
              downloadJson("mdjh-export-with-key.json", exportPayload(saveEntries, llmConfig, true));
            }}
            className="rounded-[16px] bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-400/20"
          >
            导出（含 key）
          </button>
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-xs text-stone-500">快速入口</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-[16px] bg-white/5 px-3 py-1.5 text-xs text-stone-100 transition hover:bg-white/10"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
