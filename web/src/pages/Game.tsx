import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";
import { trainingActions } from "@/data/game-data";
import { formatDateTime, formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function Game() {
  const activeSave = useAppStore((state) => state.activeSave);
  const isOnline = useAppStore((state) => state.isOnline);
  const llmConfig = useAppStore((state) => state.llmConfig);
  const validation = useAppStore((state) => state.validation);
  const isGenerating = useAppStore((state) => state.isGenerating);
  const lastStoryError = useAppStore((state) => state.lastStoryError);
  const progressStory = useAppStore((state) => state.progressStory);
  const applyOfflineTraining = useAppStore((state) => state.applyOfflineTraining);
  const appendNote = useAppStore((state) => state.appendNote);
  const saveToSlot = useAppStore((state) => state.saveToSlot);

  const [input, setInput] = useState("");

  const configReady =
    Boolean(llmConfig?.lastValidatedAt) && validation.status === "success";

  const canProgress = Boolean(
    isOnline && configReady && activeSave && input.trim().length > 0 && !isGenerating,
  );

  const latest = activeSave?.recentEvents[0];
  const orderedEvents = useMemo(() => {
    if (!activeSave) return [];
    return [...activeSave.recentEvents].slice(0, 18);
  }, [activeSave]);

  return (
    <AppFrame
      title="行旅之中"
      subtitle={
        activeSave
          ? `${activeSave.player.location} · ${activeSave.player.title} · 等级 ${activeSave.player.stats.level}`
          : "尚无存档，请先开启新局。"
      }
      actions={
        activeSave ? (
          <button
            type="button"
            onClick={() => saveToSlot("recent-stable")}
            className="rounded-[18px] bg-white/5 px-4 py-2 text-sm text-stone-100 transition hover:bg-white/10"
          >
            存为稳定点
          </button>
        ) : (
          <Link
            to="/new-game"
            className="rounded-[18px] bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
          >
            去开新局
          </Link>
        )
      }
    >
      {activeSave ? (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-4">
            <SectionCard eyebrow="江湖回响" title={latest?.title ?? "尚无回合"}>
              <div className="space-y-3">
                <div className="whitespace-pre-wrap text-sm leading-6 text-stone-200">
                  {latest?.narrative ?? "你踏上古道，风声穿林，等待下一次抉择。"}
                </div>
                {latest?.deltas ? (
                  <div className="flex flex-wrap gap-2 text-xs text-stone-400">
                    {typeof latest.deltas.hp === "number" ? (
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        HP {formatDelta(latest.deltas.hp)}
                      </span>
                    ) : null}
                    {typeof latest.deltas.mp === "number" ? (
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        MP {formatDelta(latest.deltas.mp)}
                      </span>
                    ) : null}
                    {typeof latest.deltas.exp === "number" ? (
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        EXP {formatDelta(latest.deltas.exp)}
                      </span>
                    ) : null}
                    {typeof latest.deltas.money === "number" ? (
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        银两 {formatDelta(latest.deltas.money)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {activeSave.suggestedActions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeSave.suggestedActions.slice(0, 4).map((action) => (
                      <button
                        type="button"
                        key={action}
                        onClick={() => setInput(action)}
                        className="rounded-[16px] bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-400/20"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard eyebrow="输入" title="推进下一幕">
              <div className="grid gap-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="输入你的行动或对白…"
                  rows={3}
                  className="w-full resize-none rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-300/40"
                />
                {lastStoryError ? (
                  <p className="text-xs text-rose-300">{lastStoryError}</p>
                ) : null}
                {!isOnline ? (
                  <p className="text-xs text-stone-500">
                    当前离线：只能本地修行与回放。联网推进需要恢复网络连接。
                  </p>
                ) : !configReady ? (
                  <p className="text-xs text-stone-500">
                    模型尚未验证：请先前往 <Link className="text-amber-200 hover:underline" to="/llm-config">模型配置</Link> 测试通过。
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canProgress}
                    onClick={async () => {
                      const current = input.trim();
                      if (!current) return;
                      setInput("");
                      await progressStory(current);
                    }}
                    className={cn(
                      "rounded-[18px] px-4 py-2 text-sm transition",
                      canProgress
                        ? "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                        : "bg-white/5 text-stone-500",
                    )}
                  >
                    {isGenerating ? "推演中…" : "推进剧情"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const current = input.trim();
                      if (!current) return;
                      setInput("");
                      await appendNote(current);
                    }}
                    className="rounded-[18px] bg-white/5 px-4 py-2 text-sm text-stone-100 transition hover:bg-white/10"
                  >
                    随手记
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4">
            <SectionCard eyebrow="状态" title="当前身心">
              <div className="grid gap-3 text-xs text-stone-400">
                <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                  <span>HP</span>
                  <span className="text-stone-100">
                    {activeSave.player.stats.hp}/{activeSave.player.stats.hpMax}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                  <span>MP</span>
                  <span className="text-stone-100">
                    {activeSave.player.stats.mp}/{activeSave.player.stats.mpMax}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                  <span>银两</span>
                  <span className="text-stone-100">{activeSave.player.money}</span>
                </div>
                <p className="text-[11px] text-stone-600">
                  最后保存：{formatDateTime(activeSave.updatedAt)}
                </p>
              </div>
            </SectionCard>

            <SectionCard eyebrow="离线" title="本地修行">
              <div className="grid gap-2">
                {trainingActions.map((action) => (
                  <button
                    type="button"
                    key={action.id}
                    onClick={() => applyOfflineTraining(action.id)}
                    className="flex items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                  >
                    <div>
                      <p className="text-sm text-stone-100">{action.label}</p>
                      <p className="mt-1 text-xs text-stone-500">{action.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-stone-500">
                      EXP {formatDelta(action.deltas.exp)}
                    </span>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard eyebrow="回放" title="最近记录">
              <div className="space-y-3">
                {orderedEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-stone-100">{event.title}</p>
                      <span className="text-[11px] text-stone-600">{formatDateTime(event.timestamp)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-400">
                      {event.outcome}
                    </p>
                  </div>
                ))}
                <Link
                  to="/codex"
                  className="block rounded-[18px] bg-white/5 px-4 py-3 text-center text-xs text-stone-300 transition hover:bg-white/10"
                >
                  打开卷册查看全部
                </Link>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : (
        <SectionCard eyebrow="提示" title="尚无存档">
          <div className="space-y-4">
            <p className="text-sm text-stone-400">
              你还没有存档。先选择门派开局，才能开始离线修行与剧情推进。
            </p>
            <Link
              to="/new-game"
              className="inline-flex w-fit rounded-[18px] bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
            >
              去开启新局
            </Link>
          </div>
        </SectionCard>
      )}
    </AppFrame>
  );
}
