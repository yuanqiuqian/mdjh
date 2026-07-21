import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import keyboard02 from "@/assets/keyboard02.ogg";
import { GamePanelContent, type GamePanelKey } from "@/components/game/GamePanels";
import { ModelSettingsForm } from "@/components/game/ModelSettingsForm";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModalFrame } from "@/components/ui/ModalFrame";
import { trainingActions } from "@/data/game-data";
import { gameMenuItems } from "@/data/game-menu";
import { getOfflineTrainingStatus } from "@/features/game/engine";
import { formatDateTime, formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import type { CombatRoundLog } from "@/types/game";

const TYPEWRITER_INTERVAL_MS = 18;
const COMBAT_LOG_REVEAL_INTERVAL_MS = 480;
const AUDIO_TICK_INTERVAL_MS = 65;

const groupCombatLogs = (logs: CombatRoundLog[]) => {
  const rounds = new Map<number, CombatRoundLog[]>();
  for (const log of logs) {
    const current = rounds.get(log.round) ?? [];
    current.push(log);
    rounds.set(log.round, current);
  }
  return Array.from(rounds.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([round, items]) => ({ round, items }));
};

const getCombatStepLabel = (log?: CombatRoundLog) => {
  if (!log) {
    return "等待你的指令";
  }
  return log.actorId === "player" ? "你的回合已出手" : "敌方正在应对";
};

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
  const performCombatAction = useAppStore((state) => state.performCombatAction);
  const saveToSlot = useAppStore((state) => state.saveToSlot);
  const setDebugMode = useAppStore((state) => state.setDebugMode);

  const [input, setInput] = useState("");
  const [combatTargetId, setCombatTargetId] = useState("");
  const [typedPreview, setTypedPreview] = useState("");
  const [revealedCombatLogCount, setRevealedCombatLogCount] = useState(0);
  const [isCombatAnimating, setIsCombatAnimating] = useState(false);
  const [combatBeatText, setCombatBeatText] = useState("等待你的指令");
  const [activeModal, setActiveModal] = useState<GamePanelKey | "model-settings" | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioAtRef = useRef(0);
  const lastTypedLengthRef = useRef(0);
  const storyScrollRef = useRef<HTMLDivElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const revealedLogCountRef = useRef(0);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const configReady =
    Boolean(llmConfig?.lastValidatedAt) && validation.status === "success";

  const canProgress = Boolean(
    isOnline &&
      configReady &&
      activeSave &&
      activeSave.gameMode === "dialogue" &&
      input.trim().length > 0 &&
      !isGenerating,
  );

  const latest = activeSave?.recentEvents[0];
  const combat = activeSave?.combatState ?? null;
  const orderedEvents = useMemo(() => {
    if (!activeSave) return [];
    return [...activeSave.recentEvents].slice(0, 18);
  }, [activeSave]);
  const visibleEvents = useMemo(() => orderedEvents.slice(0, 4), [orderedEvents]);
  const livingEnemies = useMemo(
    () => combat?.enemies.filter((enemy) => enemy.hp > 0) ?? [],
    [combat],
  );
  const consumables = useMemo(
    () => activeSave?.inventory.filter((item) => item.type === "消耗品") ?? [],
    [activeSave],
  );
  const streamingPreview = lastStoryDebug?.narrativePreview?.trim() ?? "";
  const echoNarrative = isGenerating
    ? typedPreview || streamingPreview || "风穿过檐角，新的回响正在聚拢。"
    : latest?.narrative ?? "你踏上古道，风声穿林，等待下一次抉择。";
  const echoTitle = isGenerating ? "AI 正在书写此回合" : latest?.title ?? "尚无回合";
  const combatHeadline = combat?.logs.at(-1)?.summary ?? combat?.introNarrative ?? "";
  const visibleCombatLogs = useMemo(
    () => (combat ? combat.logs.slice(0, revealedCombatLogCount) : []),
    [combat, revealedCombatLogCount],
  );
  const combatRounds = useMemo(() => groupCombatLogs(visibleCombatLogs), [visibleCombatLogs]);
  const combatActionLocked = isCombatAnimating || isGenerating;
  const trainingStatus = activeSave ? getOfflineTrainingStatus(activeSave) : null;
  const activeMenuItem = useMemo(
    () => gameMenuItems.find((item) => item.id === activeModal),
    [activeModal],
  );

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
   * Closes the in-game menu when the player clicks outside of it or presses Escape.
   */
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  /**
   * Closes the small menu whenever a full modal takes over the screen.
   */
  useEffect(() => {
    if (activeModal) {
      setIsMenuOpen(false);
    }
  }, [activeModal]);

  useEffect(() => {
    if (!combat || livingEnemies.length === 0) {
      setCombatTargetId("");
      return;
    }
    if (!livingEnemies.some((enemy) => enemy.id === combatTargetId)) {
      setCombatTargetId(livingEnemies[0]?.id ?? "");
    }
  }, [combat, combatTargetId, livingEnemies]);

  useEffect(() => {
    if (!combat) {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
      revealTimerRef.current = null;
      revealedLogCountRef.current = 0;
      setRevealedCombatLogCount(0);
      setIsCombatAnimating(false);
      setCombatBeatText("等待你的指令");
      return;
    }

    if (combat.logs.length === 0) {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
      revealTimerRef.current = null;
      revealedLogCountRef.current = 0;
      setRevealedCombatLogCount(0);
      setIsCombatAnimating(false);
      setCombatBeatText(combat.introNarrative);
      return;
    }

    if (combat.logs.length < revealedLogCountRef.current) {
      revealedLogCountRef.current = combat.logs.length;
      setRevealedCombatLogCount(combat.logs.length);
      setIsCombatAnimating(false);
      setCombatBeatText(getCombatStepLabel(combat.logs.at(-1)));
      return;
    }

    if (combat.logs.length === revealedLogCountRef.current) {
      setCombatBeatText(getCombatStepLabel(combat.logs.at(-1)));
      return;
    }

    setIsCombatAnimating(true);

    const revealNext = () => {
      const nextIndex = revealedLogCountRef.current;
      const nextLog = combat.logs[nextIndex];
      if (!nextLog) {
        setIsCombatAnimating(false);
        setCombatBeatText("等待你的指令");
        revealTimerRef.current = null;
        return;
      }

      const nextCount = nextIndex + 1;
      revealedLogCountRef.current = nextCount;
      setRevealedCombatLogCount(nextCount);
      setCombatBeatText(`${getCombatStepLabel(nextLog)} · ${nextLog.summary}`);

      if (nextCount < combat.logs.length) {
        revealTimerRef.current = window.setTimeout(revealNext, COMBAT_LOG_REVEAL_INTERVAL_MS);
        return;
      }

      revealTimerRef.current = window.setTimeout(() => {
        setIsCombatAnimating(false);
        setCombatBeatText("回合已结算，轮到你选择下一步");
        revealTimerRef.current = null;
      }, 240);
    };

    revealTimerRef.current = window.setTimeout(revealNext, 160);

    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [combat]);

  /**
   * Animates streamed preview text into a typewriter-style narrative.
   */
  useEffect(() => {
    if (!isGenerating) {
      setTypedPreview("");
      lastTypedLengthRef.current = 0;
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
    if (!isGenerating || !audioRef.current) {
      return;
    }

    if (typedPreview.length <= lastTypedLengthRef.current) {
      lastTypedLengthRef.current = typedPreview.length;
      return;
    }

    const now = Date.now();
    if (now - lastAudioAtRef.current < AUDIO_TICK_INTERVAL_MS) {
      lastTypedLengthRef.current = typedPreview.length;
      return;
    }

    lastAudioAtRef.current = now;
    lastTypedLengthRef.current = typedPreview.length;

    const audio = audioRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, [isGenerating, typedPreview]);

  /**
   * Warms up the typing audio during a user gesture to reduce autoplay blocking.
   */
  const primeTypingAudio = () => {
    if (!audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    audio.muted = true;
    audio.currentTime = 0;
    void audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  };

  /**
   * Moves the player back to the top of the current scene before streaming starts.
   */
  const scrollStoryToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    storyScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * Submits the current dialogue input and prepares the viewport for streamed output.
   */
  const submitProgress = async () => {
    const current = input.trim();
    if (!current || !canProgress) {
      return;
    }
    primeTypingAudio();
    scrollStoryToTop();
    setInput("");
    await progressStory(current);
  };

  /**
   * Appends a quick note from the shared input area.
   */
  const submitNote = async () => {
    const current = input.trim();
    if (!current) {
      return;
    }
    setInput("");
    await appendNote(current);
  };

  /**
   * Sends the current input with Shift/Cmd/Ctrl + Enter for faster keyboard play.
   */
  const handleInputKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    if (!(event.shiftKey || event.metaKey || event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    await submitProgress();
  };

  return (
    <AppFrame
      title="当前剧情"
      subtitle={
        activeSave
          ? `${activeSave.player.location} · ${activeSave.player.title} · 等级 ${activeSave.player.stats.level}`
          : "尚无存档，请先开始新游戏。"
      }
      actions={
        activeSave ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((current) => !current)}
                className={cn(
                  "flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm transition",
                  isMenuOpen
                    ? "bg-amber-400/15 text-amber-100"
                    : "bg-white/5 text-stone-100 hover:bg-white/10",
                )}
              >
                <span>菜单</span>
                <span
                  className={cn(
                    "text-[10px] text-stone-500 transition",
                    isMenuOpen ? "rotate-180 text-amber-100/80" : "",
                  )}
                >
                  v
                </span>
              </button>
              {isMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.6rem)] z-20 w-72 overflow-hidden rounded-[24px] border border-amber-300/15 bg-stone-950/96 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70">
                      游戏菜单
                    </p>
                    <p className="mt-1 text-sm text-stone-300">人物、背包、日志、存档都从这里打开。</p>
                  </div>
                  <div className="grid gap-1 p-2">
                    {gameMenuItems.map((item, index) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setIsMenuOpen(false);
                          setActiveModal(item.id);
                        }}
                        className="flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition hover:bg-white/5"
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] text-stone-400">
                          0{index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm text-stone-100">{item.label}</span>
                          <span className="mt-1 block text-[11px] leading-5 text-stone-500">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
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
            to="/"
            className="rounded-[18px] bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
          >
            回首页开始新游戏
          </Link>
        )
      }
    >
      {activeSave ? (
        activeSave.gameMode === "gameover" ? (
          <div className="mx-auto grid min-h-[calc(100vh-18rem)] max-w-4xl place-items-center">
            <SectionCard
              eyebrow="终局"
              title="游戏结束"
              className="relative w-full overflow-hidden border-rose-300/15 bg-[radial-gradient(circle_at_top,_rgba(190,24,93,0.16),_transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-0 shadow-[0_30px_100px_rgba(0,0,0,0.52)]"
            >
              <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(244,63,94,0.18),transparent)]" />
              <div className="absolute right-[-4rem] top-10 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl" />
              <div className="absolute left-[-3rem] bottom-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />

              <div className="relative grid gap-6 px-6 py-8 sm:px-8 sm:py-10">
                <div className="space-y-3 border-b border-white/10 pb-6">
                  <p className="text-[11px] uppercase tracking-[0.38em] text-rose-200/70">Battle Lost</p>
                  <h3 className="font-serif text-[32px] leading-tight text-stone-50 sm:text-[40px]">
                    胜败乃兵家常事
                  </h3>
                  <p className="max-w-2xl text-base leading-8 text-stone-300">
                    大侠请重新来过。你在这一战中力竭倒下，这段江湖路暂时走到了尽头，
                    但江湖从不只认一场胜负。
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[24px] border border-white/10 bg-black/25 p-5">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-stone-500">最后记录</p>
                    <p className="mt-3 text-base text-stone-100">{latest?.title ?? "战斗结算"}</p>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-400">
                      {latest?.outcome ?? "这场恶战已经划下句点。"}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-[24px] border border-rose-300/15 bg-rose-400/8 p-5">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-rose-200/70">败北提示</p>
                      <p className="mt-3 text-sm leading-7 text-stone-300">
                        你可以回到首页直接开启新局，或读取之前保留下来的稳定进度，再次挑战这一关。
                      </p>
                    </div>

                    <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <Link
                        to="/"
                        className="rounded-[18px] bg-amber-400/18 px-4 py-3 text-center text-sm text-amber-50 transition hover:bg-amber-400/28"
                      >
                        返回首页，重新开始
                      </Link>
                      <button
                        type="button"
                        onClick={() => setActiveModal("saves")}
                        className="rounded-[18px] bg-white/5 px-4 py-3 text-sm text-stone-100 transition hover:bg-white/10"
                      >
                        读取之前的进度
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : activeSave.gameMode === "combat" && combat ? (
          <div className="grid gap-3 xl:min-h-[calc(100vh-13rem)] xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
            <div className="grid gap-3">
              <SectionCard eyebrow="交战模式" title={`${combat.title} · 第 ${combat.round} 回合`}>
                <div className="space-y-4">
                  <div className="rounded-[20px] border border-rose-300/20 bg-rose-400/5 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-rose-100/70">战斗目标</p>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px]",
                          isGenerating
                            ? "bg-amber-300/10 text-amber-100"
                            : isCombatAnimating
                              ? "bg-cyan-300/10 text-cyan-100"
                              : "bg-emerald-300/10 text-emerald-100",
                        )}
                      >
                        {isGenerating
                          ? "战后续写中"
                          : isCombatAnimating
                            ? "本回合结算中"
                            : "轮到你行动"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-100">{combat.objective}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-400">
                      {combatHeadline}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">回合节奏</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-[16px] bg-amber-400/10 px-3 py-2 text-center text-amber-100">
                        1. 你出手
                      </div>
                      <div
                        className={cn(
                          "rounded-[16px] px-3 py-2 text-center",
                          isCombatAnimating
                            ? "bg-cyan-400/10 text-cyan-100"
                            : "bg-white/5 text-stone-500",
                        )}
                      >
                        2. 敌方应对
                      </div>
                      <div
                        className={cn(
                          "rounded-[16px] px-3 py-2 text-center",
                          !isCombatAnimating && !isGenerating
                            ? "bg-emerald-400/10 text-emerald-100"
                            : "bg-white/5 text-stone-500",
                        )}
                      >
                        3. 下一回合
                      </div>
                    </div>
                    <p className="mt-3 rounded-[16px] bg-black/20 px-3 py-2 text-xs leading-5 text-stone-300">
                      {combatBeatText}
                    </p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-400/5 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-stone-100">{combat.player.name}</p>
                        <span className="text-xs text-stone-500">我方</span>
                      </div>
                      <div className="mt-3 space-y-3 text-xs text-stone-300">
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <span>HP</span>
                            <span>{combat.player.hp}/{combat.player.hpMax}</span>
                          </div>
                          <div className="h-2 rounded-full bg-black/30">
                            <div
                              className="h-2 rounded-full bg-rose-300/80 transition-all"
                              style={{ width: `${(combat.player.hp / combat.player.hpMax) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <span>MP</span>
                            <span>{combat.player.mp}/{combat.player.mpMax}</span>
                          </div>
                          <div className="h-2 rounded-full bg-black/30">
                            <div
                              className="h-2 rounded-full bg-cyan-300/80 transition-all"
                              style={{ width: `${(combat.player.mp / Math.max(1, combat.player.mpMax)) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-[16px] bg-black/20 px-3 py-2">攻击 {combat.player.atk}</div>
                          <div className="rounded-[16px] bg-black/20 px-3 py-2">护甲 {combat.player.arm}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">选定目标</p>
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {livingEnemies.map((enemy) => (
                          <button
                            type="button"
                            key={enemy.id}
                            onClick={() => setCombatTargetId(enemy.id)}
                            className={cn(
                              "min-w-[180px] shrink-0 rounded-[18px] border px-4 py-3 text-left transition",
                              combatTargetId === enemy.id
                                ? "border-amber-300/40 bg-amber-400/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-stone-100">{enemy.name}</p>
                                <p className="mt-1 text-[11px] text-stone-500">
                                  {enemy.isBoss ? "首领" : "敌方"} · LV {enemy.level}
                                </p>
                              </div>
                              <span className="text-[11px] text-stone-500">
                                {combatTargetId === enemy.id ? "已锁定" : "可选"}
                              </span>
                            </div>
                            <div className="mt-3">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-stone-400">
                                <span>HP</span>
                                <span>{enemy.hp}/{enemy.hpMax}</span>
                              </div>
                              <div className="h-2 rounded-full bg-black/30">
                                <div
                                  className="h-2 rounded-full bg-rose-300/80 transition-all"
                                  style={{ width: `${(enemy.hp / enemy.hpMax) * 100}%` }}
                                />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard eyebrow="回合操作" title="本回合指令">
                <div className="grid gap-4">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={livingEnemies.length === 0 || combatActionLocked}
                      onClick={() =>
                        performCombatAction({
                          type: "attack",
                          targetId: combatTargetId || livingEnemies[0]?.id || "",
                        })
                      }
                      className={cn(
                        "rounded-[18px] px-4 py-3 text-sm transition",
                        livingEnemies.length > 0 && !combatActionLocked
                          ? "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                          : "bg-white/5 text-stone-500",
                      )}
                    >
                      进攻
                    </button>
                    <button
                      type="button"
                      disabled={combatActionLocked}
                      onClick={() => performCombatAction({ type: "defend" })}
                      className={cn(
                        "rounded-[18px] px-4 py-3 text-sm transition",
                        !combatActionLocked
                          ? "bg-white/5 text-stone-100 hover:bg-white/10"
                          : "bg-white/5 text-stone-500",
                      )}
                    >
                      防御
                    </button>
                    <button
                      type="button"
                      disabled={combatActionLocked}
                      onClick={() => performCombatAction({ type: "flee" })}
                      className={cn(
                        "rounded-[18px] px-4 py-3 text-sm transition",
                        !combatActionLocked
                          ? "bg-white/5 text-stone-100 hover:bg-white/10"
                          : "bg-white/5 text-stone-500",
                      )}
                    >
                      逃跑
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">技能</p>
                      <div className="grid gap-2">
                        {combat.player.skills.map((skill) => (
                          <button
                            type="button"
                            key={skill.id}
                            disabled={combatActionLocked}
                            onClick={() =>
                              performCombatAction({
                                type: "skill",
                                skillId: skill.id,
                                targetId: skill.target === "enemy" ? combatTargetId || livingEnemies[0]?.id : undefined,
                              })
                            }
                            className={cn(
                              "rounded-[18px] border px-4 py-3 text-left transition",
                              !combatActionLocked
                                ? "border-white/10 bg-white/5 hover:bg-white/10"
                                : "border-white/10 bg-white/5 text-stone-500",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-stone-100">{skill.name}</span>
                              <span className="text-[11px] text-stone-500">MP {skill.mpCost}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-stone-500">{skill.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">道具</p>
                      <div className="grid gap-2">
                        {consumables.length > 0 ? (
                          consumables.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              disabled={combatActionLocked}
                              onClick={() => performCombatAction({ type: "item", itemId: item.id })}
                              className={cn(
                                "rounded-[18px] border px-4 py-3 text-left transition",
                                !combatActionLocked
                                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                                  : "border-white/10 bg-white/5 text-stone-500",
                              )}
                            >
                              <p className="text-sm text-stone-100">{item.name}</p>
                              <p className="mt-1 text-xs leading-5 text-stone-500">{item.description}</p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-xs text-stone-500">
                            当前没有可用消耗品。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {(combatActionLocked || isGenerating) ? (
                    <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs leading-5 text-cyan-100/90">
                      {isGenerating
                        ? "战斗已经结束，AI 正在接续战后剧情。"
                        : "当前回合正在依次结算，请先看完你来我往的过程。"}
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-3 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto xl:pr-1 xl:pb-2">
              <SectionCard eyebrow="战斗播报" title="按回合回放">
                <div className="space-y-3">
                  {combatRounds.length > 0 ? (
                    combatRounds.map((roundGroup) => (
                      <div key={roundGroup.round} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-stone-100">第 {roundGroup.round} 回合</p>
                          <span className="text-[11px] text-stone-600">
                            {roundGroup.items.length} 步
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {roundGroup.items.map((log) => (
                            <div
                              key={log.id}
                              className={cn(
                                "rounded-[16px] px-3 py-2 text-xs leading-5",
                                log.actorId === "player"
                                  ? "bg-amber-400/10 text-amber-100"
                                  : "bg-white/5 text-stone-300",
                              )}
                            >
                              <p className="text-[11px] opacity-75">{log.actorName}</p>
                              <p className="mt-1 whitespace-pre-wrap">{log.summary}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-400">
                      {combat.introNarrative}
                    </div>
                  )}
                  {isCombatAnimating ? (
                    <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs text-cyan-100">
                      本回合正在分步播报中……
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard eyebrow="记录" title="最近记录">
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
                    to="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveModal("logs");
                    }}
                    className="block rounded-[18px] bg-white/5 px-4 py-3 text-center text-xs text-stone-300 transition hover:bg-white/10"
                  >
                    打开日志查看全部
                  </Link>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 xl:min-h-[calc(100vh-13rem)] xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] xl:items-start">
            <div className="grid gap-3 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_auto]">
              <SectionCard
                eyebrow="江湖回响"
                title={echoTitle}
                className="xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden"
              >
                <div className="space-y-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:space-y-0">
                  <div
                    ref={storyScrollRef}
                    className="whitespace-pre-wrap text-sm leading-6 text-stone-200 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2 xl:leading-5"
                  >
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
                      onKeyDown={handleInputKeyDown}
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
                    <p className="text-[11px] text-stone-500">
                      快捷发送：`Shift + Enter` / `Command + Enter` / `Control + Enter`
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!canProgress}
                        onClick={submitProgress}
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
                        onClick={submitNote}
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
                <div className="space-y-3">
                  <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100/85">
                    <p>
                      本幕剩余修行次数：{trainingStatus?.remainingUses ?? 0}/2
                    </p>
                    <p className="mt-1 text-amber-100/65">
                      每推进一幕前最多修行 2 次，且同一招式只能使用 1 次，避免无限刷经验。
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                  {trainingActions.map((action) => (
                    (() => {
                      const isUsed = trainingStatus?.usedActionLabels.has(action.label) ?? false;
                      const isLocked = trainingStatus?.needsStoryAdvance ?? false;
                      const disabled = isUsed || isLocked;
                      const badgeText = isLocked ? "需推进剧情" : isUsed ? "本幕已用" : `EXP ${formatDelta(action.deltas.exp)}`;
                      return (
                    <button
                      type="button"
                      key={action.id}
                      disabled={disabled}
                      onClick={() => applyOfflineTraining(action.id)}
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
                      <span className="shrink-0 text-[11px] text-stone-500">
                        {badgeText}
                      </span>
                    </button>
                      );
                    })()
                  ))}
                  </div>
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
                    to="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveModal("logs");
                    }}
                    className="block rounded-[18px] bg-white/5 px-4 py-3 text-center text-xs text-stone-300 transition hover:bg-white/10"
                  >
                    打开日志查看全部
                  </Link>
                </div>
              </SectionCard>
            </div>
          </div>
        )
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
              去开始新游戏
            </Link>
          </div>
        </SectionCard>
      )}
      {activeMenuItem ? (
        <ModalFrame
          title={activeMenuItem.label}
          description={activeMenuItem.description}
          onClose={() => setActiveModal(null)}
          widthClassName={activeMenuItem.id === "logs" ? "max-w-6xl" : "max-w-5xl"}
        >
          <GamePanelContent
            panel={activeMenuItem.id}
            onLoaded={() => setActiveModal(null)}
            onOpenModelSettings={() => setActiveModal("model-settings")}
          />
        </ModalFrame>
      ) : null}
      {activeModal === "model-settings" ? (
        <ModalFrame
          title="模型设置"
          description="配置 endpoint、model_id、api_key，并测试当前模型连接。"
          onClose={() => setActiveModal(null)}
          widthClassName="max-w-6xl"
        >
          <ModelSettingsForm />
        </ModalFrame>
      ) : null}
    </AppFrame>
  );
}
