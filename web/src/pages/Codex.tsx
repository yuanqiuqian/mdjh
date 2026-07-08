import { useMemo } from "react";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";
import { favorLabel, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { redactApiKey } from "@/services/llm";
import { useAppStore } from "@/store/useAppStore";
import type { LlmConfig, SaveEntry } from "@/types/game";

const exportPayload = (entries: SaveEntry[], llmConfig: LlmConfig | null, includeKey: boolean) => {
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

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

export default function Codex() {
  const activeSave = useAppStore((state) => state.activeSave);
  const saveEntries = useAppStore((state) => state.saveEntries);
  const currentPanel = useAppStore((state) => state.currentPanel);
  const setCurrentPanel = useAppStore((state) => state.setCurrentPanel);
  const saveToSlot = useAppStore((state) => state.saveToSlot);
  const loadFromSlot = useAppStore((state) => state.loadFromSlot);
  const clearSlot = useAppStore((state) => state.clearSlot);
  const llmConfig = useAppStore((state) => state.llmConfig);
  const validation = useAppStore((state) => state.validation);

  const panels = useMemo(
    () =>
      [
        { id: "overview" as const, label: "概览" },
        { id: "character" as const, label: "角色" },
        { id: "inventory" as const, label: "背包" },
        { id: "relations" as const, label: "关系" },
        { id: "logs" as const, label: "日志" },
      ] satisfies Array<{ id: typeof currentPanel; label: string }>,
    [currentPanel],
  );

  const configReady =
    Boolean(llmConfig?.lastValidatedAt) && validation.status === "success";

  return (
    <AppFrame
      title="卷册"
      subtitle="在这里整理存档、回放事件、查看关系与背包，并导出数据以便迁移或备份。"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              downloadJson("mdjh-export.json", exportPayload(saveEntries, llmConfig, false));
            }}
            className="rounded-[18px] bg-white/5 px-4 py-2 text-sm text-stone-100 transition hover:bg-white/10"
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
            className="rounded-[18px] bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
          >
            导出（含 key）
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          <SectionCard eyebrow="存档位" title="管理存档">
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
                        onClick={() => loadFromSlot(entry.id)}
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
          </SectionCard>

          <SectionCard eyebrow="模型" title="当前配置">
            <div className="grid gap-2 text-sm text-stone-300">
              {llmConfig ? (
                <>
                  <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs text-stone-500">endpoint</p>
                    <p className="mt-1 break-all text-sm text-stone-100">{llmConfig.endpoint}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs text-stone-500">model_id</p>
                      <p className="mt-1 text-sm text-stone-100">{llmConfig.modelId}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs text-stone-500">api_key</p>
                      <p className="mt-1 text-sm text-stone-100">{redactApiKey(llmConfig.apiKey)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500">
                    状态：{configReady ? "已验证" : "未验证"} · {validation.message}
                  </p>
                </>
              ) : (
                <p className="text-sm text-stone-400">尚未保存模型配置。</p>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4">
          <SectionCard eyebrow="内容" title="查看卷册">
            <div className="flex flex-wrap gap-2">
              {panels.map((panel) => (
                <button
                  type="button"
                  key={panel.id}
                  onClick={() => setCurrentPanel(panel.id)}
                  className={cn(
                    "rounded-[16px] px-3 py-1.5 text-xs transition",
                    currentPanel === panel.id
                      ? "bg-amber-400/10 text-amber-100"
                      : "bg-white/5 text-stone-300 hover:bg-white/10",
                  )}
                >
                  {panel.label}
                </button>
              ))}
            </div>
          </SectionCard>

          {activeSave ? (
            <SectionCard eyebrow="当前进度" title={activeSave.player.name}>
              {currentPanel === "overview" ? (
                <div className="grid gap-3 text-sm text-stone-300">
                  <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs text-stone-500">性格与立场</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-200">
                      {activeSave.player.personalitySummary}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs text-stone-500">长期摘要</p>
                    <ul className="mt-2 space-y-2 text-xs leading-5 text-stone-300">
                      {activeSave.longSummary.slice(-10).reverse().map((line) => (
                        <li key={line} className="rounded-[16px] bg-black/20 px-3 py-2">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {currentPanel === "character" ? (
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
                </div>
              ) : null}

              {currentPanel === "inventory" ? (
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
              ) : null}

              {currentPanel === "relations" ? (
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
              ) : null}

              {currentPanel === "logs" ? (
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
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard eyebrow="提示" title="尚无存档">
              <p className="text-sm text-stone-400">先开启新局，卷册才能收录你的江湖故事。</p>
            </SectionCard>
          )}
        </div>
      </div>
    </AppFrame>
  );
}

