import { Link } from "react-router-dom";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDateTime, formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GameRuntimeState } from "@/components/game/runtime/useGameRuntime";

type DialogueSceneDesktopProps = {
  state: GameRuntimeState;
};

export function DialogueSceneDesktop({ state }: DialogueSceneDesktopProps) {
  if (!state.activeSave) {
    return null;
  }

  return (
    <div className="grid gap-3 xl:min-h-[calc(100vh-13rem)] xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] xl:items-start">
      <div className="grid gap-3 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_auto]">
        <SectionCard
          eyebrow="江湖回响"
          title={state.echoTitle}
          className="xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden"
        >
          <div className="space-y-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:space-y-0">
            <div
              ref={state.storyScrollRef}
              className="whitespace-pre-wrap text-sm leading-6 text-stone-200 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2 xl:leading-5"
            >
              {state.echoNarrative}
              {state.isGenerating ? (
                <span className="ml-1 inline-block h-4 w-[2px] translate-y-[2px] animate-pulse rounded-full bg-amber-200/80 align-middle" />
              ) : null}
            </div>
            <div className="mt-3 space-y-3 xl:mt-4 xl:shrink-0">
              {state.isGenerating ? (
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
                  {state.currentStoryRequest ? (
                    <p className="mt-3 rounded-[16px] bg-black/20 px-3 py-2 text-xs leading-5 text-stone-300">
                      本轮输入：{state.currentStoryRequest}
                    </p>
                  ) : null}
                </div>
              ) : state.latest?.deltas ? (
                <div className="flex flex-wrap gap-2 text-xs text-stone-400">
                  {typeof state.latest.deltas.hp === "number" ? (
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      HP {formatDelta(state.latest.deltas.hp)}
                    </span>
                  ) : null}
                  {typeof state.latest.deltas.mp === "number" ? (
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      MP {formatDelta(state.latest.deltas.mp)}
                    </span>
                  ) : null}
                  {typeof state.latest.deltas.exp === "number" ? (
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      EXP {formatDelta(state.latest.deltas.exp)}
                    </span>
                  ) : null}
                  {typeof state.latest.deltas.money === "number" ? (
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      银两 {formatDelta(state.latest.deltas.money)}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {!state.isGenerating && state.activeSave.suggestedActions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {state.activeSave.suggestedActions.slice(0, 4).map((action) => (
                    <button
                      type="button"
                      key={action}
                      onClick={() => state.setInput(action)}
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
                value={state.input}
                onChange={(event) => state.setInput(event.target.value)}
                onKeyDown={state.handleInputKeyDown}
                placeholder="输入你的行动或对白…"
                rows={3}
                className="w-full resize-none rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-300/40"
              />
              {state.lastStoryError ? (
                <p className="text-xs text-rose-300">{state.lastStoryError}</p>
              ) : null}
              {!state.isOnline ? (
                <p className="text-xs text-stone-500">
                  当前离线：只能本地修行与回放。联网推进需要恢复网络连接。
                </p>
              ) : !state.configReady ? (
                <p className="text-xs text-stone-500">
                  模型尚未验证：请先前往{" "}
                  <Link className="text-amber-200 hover:underline" to="/llm-config">
                    模型配置
                  </Link>{" "}
                  测试通过。
                </p>
              ) : null}
              <p className="text-[11px] text-stone-500">
                快捷发送：`Shift + Enter` / `Command + Enter` / `Control + Enter`
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!state.canProgress}
                  onClick={state.submitProgress}
                  className={cn(
                    "rounded-[18px] px-4 py-2 text-sm transition",
                    state.canProgress
                      ? "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                      : "bg-white/5 text-stone-500",
                  )}
                >
                  {state.isGenerating ? "推演中…" : "推进剧情"}
                </button>
                <button
                  type="button"
                  onClick={state.submitNote}
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
                  {state.activeSave.player.stats.hp}/{state.activeSave.player.stats.hpMax}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5">
                <span>MP</span>
                <span className="text-stone-100">
                  {state.activeSave.player.stats.mp}/{state.activeSave.player.stats.mpMax}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5">
                <span>银两</span>
                <span className="text-stone-100">{state.activeSave.player.money}</span>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] leading-5 text-stone-500">
                最后保存：{formatDateTime(state.activeSave.updatedAt)}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-3 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto xl:pr-1 xl:pb-2">
        {state.debugMode ? (
          <SectionCard eyebrow="调试" title="模型返回调试">
            <div className="space-y-3 text-xs text-stone-400">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">请求时间</p>
                  <p className="mt-2 break-all text-stone-200">
                    {state.lastStoryDebug?.requestedAt
                      ? formatDateTime(state.lastStoryDebug.requestedAt)
                      : "暂无"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">当前状态</p>
                  <p className="mt-2 text-stone-200">
                    {state.isGenerating
                      ? "请求进行中"
                      : state.lastStoryDebug?.errorMessage
                        ? "请求失败"
                        : state.lastStoryDebug
                          ? "最近一次成功"
                          : "暂无请求"}
                  </p>
                  <p className="mt-1 text-stone-500">
                    通道：{state.lastStoryDebug?.transport === "sse" ? "SSE 流式" : "JSON 普通返回"}
                  </p>
                  <p className="mt-1 text-stone-500">
                    结束原因：{state.lastStoryDebug?.finishReason ?? "暂无"}
                    {state.lastStoryDebug?.fallbackUsed ? " · 已回退普通 JSON" : ""}
                  </p>
                </div>
              </div>

              {[
                ["用户输入", state.lastStoryDebug?.userInput ?? "暂无"],
                ["Request URL", state.lastStoryDebug?.requestUrl || "暂无"],
                ["Request Body", state.lastStoryDebug?.requestBody || "暂无"],
                ["Narrative Preview", state.lastStoryDebug?.narrativePreview || "暂无"],
                ["Raw Payload", state.lastStoryDebug?.rawPayload || "暂无"],
                ["Extracted Content", state.lastStoryDebug?.rawContent || "暂无"],
              ].map(([label, value]) => (
                <div key={label} className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">{label}</p>
                  <pre className="max-h-48 overflow-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 whitespace-pre-wrap break-words text-stone-200">
                    {value}
                  </pre>
                </div>
              ))}

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Parsed Story</p>
                <pre className="max-h-48 overflow-auto rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-stone-200">
                  {state.lastStoryDebug?.parsedStory
                    ? JSON.stringify(state.lastStoryDebug.parsedStory, null, 2)
                    : "暂无"}
                </pre>
              </div>

              {state.lastStoryDebug?.errorMessage ? (
                <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-rose-200">
                  错误信息：{state.lastStoryDebug.errorMessage}
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard eyebrow="离线" title="本地修行">
          <div className="space-y-3">
            <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100/85">
              <p>本幕剩余修行次数：{state.trainingStatus?.remainingUses ?? 0}/2</p>
              <p className="mt-1 text-amber-100/65">
                每推进一幕前最多修行 2 次，且同一招式只能使用 1 次，避免无限刷经验。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {state.trainingActions.map((action) => {
                const isUsed = state.trainingStatus?.usedActionLabels.has(action.label) ?? false;
                const isLocked = state.trainingStatus?.needsStoryAdvance ?? false;
                const disabled = isUsed || isLocked;
                const badgeText = isLocked
                  ? "需推进剧情"
                  : isUsed
                    ? "本幕已用"
                    : `EXP ${formatDelta(action.deltas.exp)}`;
                return (
                  <button
                    type="button"
                    key={action.id}
                    disabled={disabled}
                    onClick={() => state.applyTrainingAction(action.id)}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition",
                      disabled
                        ? "border-white/10 bg-white/5 text-stone-500"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <div>
                      <p className="text-sm text-stone-100">{action.label}</p>
                      <p className="mt-1 text-xs text-stone-500">{action.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-stone-500">{badgeText}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="回放" title="最近记录">
          <div className="space-y-3">
            {state.visibleEvents.map((event) => (
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
              to="#"
              onClick={(event) => {
                event.preventDefault();
                state.openModal("logs");
              }}
              className="block rounded-[18px] bg-white/5 px-4 py-3 text-center text-xs text-stone-300 transition hover:bg-white/10"
            >
              打开日志查看全部
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

