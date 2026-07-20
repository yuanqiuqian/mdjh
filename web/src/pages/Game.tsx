import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import keyboard02 from "@/assets/keyboard02.ogg";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";
import { trainingActions } from "@/data/game-data";
import { formatDateTime, formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const TYPEWRITER_INTERVAL_MS = 18;
const AUDIO_TICK_INTERVAL_MS = 65;

/**
 * Renders the main in-run game screen with a denser desktop-first layout.
 */
export default function Game() {
  const activeSave = useAppStore((state) => state.activeSave);
  const isOnline = useAppStore((state) => state.isOnline);
  const llmConfig = useAppStore((state) => state.llmConfig);
  const validation = useAppStore((state) => state.validation);
  const isGenerating = useAppStore((state) => state.isGenerating);
  const debugMode = useAppStore((state) => state.debugMode);
  const currentStoryRequest = useAppStore((state) => state.currentStoryRequest);
  const lastStoryDebug = useAppStore((state) => state.lastStoryDebug);
  const lastStoryError = useAppStore((state) => state.lastStoryError);
  const progressStory = useAppStore((state) => state.progressStory);
  const applyOfflineTraining = useAppStore((state) => state.applyOfflineTraining);
  const appendNote = useAppStore((state) => state.appendNote);
  const saveToSlot = useAppStore((state) => state.saveToSlot);
  const setDebugMode = useAppStore((state) => state.setDebugMode);

  const [input, setInput] = useState("");
  const [typedPreview, setTypedPreview] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioAtRef = useRef(0);

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
  const visibleEvents = useMemo(() => orderedEvents.slice(0, 4), [orderedEvents]);
  const streamingPreview = lastStoryDebug?.narrativePreview?.trim() ?? "";
  const echoNarrative = isGenerating
    ? typedPreview || streamingPreview || "风穿过檐角，新的回响正在聚拢。"
    : latest?.narrative ?? "你踏上古道，风声穿林，等待下一次抉择。";
  const echoTitle = isGenerating ? "AI 正在书写此回合" : latest?.title ?? "尚无回合";

  /**
   * Creates the low-volume typing sound used during streamed narration.
   */
  useEffect(() => {
    const audio = new Audio(keyboard02);
    audio.preload = "auto";
    audio.volume = 0.18;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  /**
   * Animates streamed preview text into a typewriter-style narrative.
   */
  useEffect(() => {
    if (!isGenerating) {
      setTypedPreview("");
      return;
    }

    if (!streamingPreview) {
      return;
    }

    if (typedPreview.length > streamingPreview.length) {
      setTypedPreview(streamingPreview);
      return;
    }

    if (typedPreview === streamingPreview) {
      return;
    }

    const remaining = streamingPreview.length - typedPreview.length;
    const chunkSize = Math.max(1, Math.min(3, Math.ceil(remaining / 14)));
    const timer = window.setTimeout(() => {
      setTypedPreview(streamingPreview.slice(0, typedPreview.length + chunkSize));
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [isGenerating, streamingPreview, typedPreview]);

  /**
   * Plays a subtle keyboard tick while the typewriter effect is revealing text.
   */
  useEffect(() => {
    if (!isGenerating || !typedPreview || !audioRef.current) {
      if (!isGenerating) {
        audioRef.current?.pause();
      }
      return;
    }

    const now = Date.now();
    if (now - lastAudioAtRef.current < AUDIO_TICK_INTERVAL_MS) {
      return;
    }

    lastAudioAtRef.current = now;
    const audio = audioRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, [isGenerating, typedPreview]);

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDebugMode(!debugMode)}
              className={cn(
                "rounded-[18px] px-4 py-2 text-sm transition",
                debugMode
                  ? "bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25"
                  : "bg-white/5 text-stone-100 hover:bg-white/10",
              )}
            >
              {debugMode ? "Debug 开" : "Debug 关"}
            </button>
            <button
              type="button"
              onClick={() => saveToSlot("recent-stable")}
              className="rounded-[18px] bg-white/5 px-4 py-2 text-sm text-stone-100 transition hover:bg-white/10"
            >
              存为稳定点
            </button>
          </div>
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
        <div className="grid gap-3 xl:min-h-[calc(100vh-13rem)] xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] xl:items-start">
          <div className="grid gap-3 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_auto]">
            <SectionCard
              eyebrow="江湖回响"
              title={echoTitle}
              className="xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden"
            >
              <div className="space-y-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:space-y-0">
                <div className="whitespace-pre-wrap text-sm leading-6 text-stone-200 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2 xl:leading-5">
                  {echoNarrative}
                  {isGenerating ? (
                    <span className="ml-1 inline-block h-4 w-[2px] translate-y-[2px] animate-pulse rounded-full bg-amber-200/80 align-middle" />
                  ) : null}
                </div>
                <div className="mt-3 space-y-3 xl:mt-4 xl:shrink-0">
                  {isGenerating ? (
                    <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/5 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-200/90 animate-pulse" />
                          <span
                            className="h-2 w-2 rounded-full bg-amber-200/70 animate-pulse"
                            style={{ animationDelay: "120ms" }}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-amber-200/50 animate-pulse"
                            style={{ animationDelay: "240ms" }}
                          />
                        </div>
                        <div>
                          <p className="text-sm text-amber-100">流式书写中</p>
                          <p className="text-xs text-amber-100/65">
                            文字正逐步落到江湖回响里，结束后会自动结算本回合。
                          </p>
                        </div>
                      </div>
                      {currentStoryRequest ? (
                        <p className="mt-3 rounded-[16px] bg-black/20 px-3 py-2 text-xs leading-5 text-stone-300">
                          本轮输入：{currentStoryRequest}
                        </p>
                      ) : null}
                    </div>
                  ) : latest?.deltas ? (
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
                  {!isGenerating && activeSave.suggestedActions.length > 0 ? (
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
              </div>
            </SectionCard>

            <SectionCard eyebrow="输入" title="推进下一幕" className="xl:sticky xl:bottom-28 xl:z-10">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
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
                      模型尚未验证：请先前往{" "}
                      <Link className="text-amber-200 hover:underline" to="/llm-config">
                        模型配置
                      </Link>{" "}
                      测试通过。
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

                <div className="grid gap-2 text-xs text-stone-400">
                  <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5">
                    <span>HP</span>
                    <span className="text-stone-100">
                      {activeSave.player.stats.hp}/{activeSave.player.stats.hpMax}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5">
                    <span>MP</span>
                    <span className="text-stone-100">
                      {activeSave.player.stats.mp}/{activeSave.player.stats.mpMax}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5">
                    <span>银两</span>
                    <span className="text-stone-100">{activeSave.player.money}</span>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] leading-5 text-stone-500">
                    最后保存：{formatDateTime(activeSave.updatedAt)}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-3 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto xl:pr-1 xl:pb-2">
            {debugMode ? (
              <SectionCard eyebrow="调试" title="模型返回调试">
                <div className="space-y-3 text-xs text-stone-400">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                        请求时间
                      </p>
                      <p className="mt-2 break-all text-stone-200">
                        {lastStoryDebug?.requestedAt
                          ? formatDateTime(lastStoryDebug.requestedAt)
                          : "暂无"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                        当前状态
                      </p>
                      <p className="mt-2 text-stone-200">
                        {isGenerating
                          ? "请求进行中"
                          : lastStoryDebug?.errorMessage
                            ? "请求失败"
                            : lastStoryDebug
                              ? "最近一次成功"
                              : "暂无请求"}
                      </p>
                      <p className="mt-1 text-stone-500">
                        通道：{lastStoryDebug?.transport === "sse" ? "SSE 流式" : "JSON 普通返回"}
                      </p>
                      <p className="mt-1 text-stone-500">
                        结束原因：{lastStoryDebug?.finishReason ?? "暂无"}
                        {lastStoryDebug?.fallbackUsed ? " · 已回退普通 JSON" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                      用户输入
                    </p>
                    <pre className="overflow-x-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 whitespace-pre-wrap break-words text-stone-200">
                      {lastStoryDebug?.userInput ?? "暂无"}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                      Request URL
                    </p>
                    <pre className="overflow-x-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 whitespace-pre-wrap break-words text-stone-200">
                      {lastStoryDebug?.requestUrl || "暂无"}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                      Request Body
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-stone-200">
                      {lastStoryDebug?.requestBody || "暂无"}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                      Narrative Preview
                    </p>
                    <pre className="max-h-40 overflow-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 whitespace-pre-wrap break-words text-stone-200">
                      {lastStoryDebug?.narrativePreview || "暂无"}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                      Raw Payload
                    </p>
                    <pre className="max-h-56 overflow-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-stone-200">
                      {lastStoryDebug?.rawPayload || "暂无"}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                      Extracted Content
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 whitespace-pre-wrap break-words text-stone-200">
                      {lastStoryDebug?.rawContent || "暂无"}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                      Parsed Story
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-stone-200">
                      {lastStoryDebug?.parsedStory
                        ? JSON.stringify(lastStoryDebug.parsedStory, null, 2)
                        : "暂无"}
                    </pre>
                  </div>

                  {lastStoryDebug?.errorMessage ? (
                    <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-rose-200">
                      错误信息：{lastStoryDebug.errorMessage}
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard eyebrow="离线" title="本地修行">
              <div className="grid gap-2 sm:grid-cols-2">
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
                {visibleEvents.map((event) => (
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
