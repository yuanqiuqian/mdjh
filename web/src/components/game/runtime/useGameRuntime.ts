import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import keyboard02 from "@/assets/keyboard02.ogg";
import { gameMenuItems, getGameMenuItem, type GameMenuPanel } from "@/data/game-menu";
import { trainingActions } from "@/data/game-data";
import { getOfflineTrainingStatus } from "@/features/game/engine";
import { useAppStore } from "@/store/useAppStore";
import type { CombatActionInput, CombatRoundLog } from "@/types/game";

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

export type GameRuntimeModal = GameMenuPanel | "model-settings" | null;

export type GameRuntimeState = {
  activeSave: ReturnType<typeof useAppStore.getState>["activeSave"];
  activeMenuItem: ReturnType<typeof getGameMenuItem> | null;
  activeModal: GameRuntimeModal;
  canProgress: boolean;
  combat: NonNullable<ReturnType<typeof useAppStore.getState>["activeSave"]>["combatState"];
  combatActionLocked: boolean;
  combatBeatText: string;
  combatHeadline: string;
  combatRounds: Array<{ round: number; items: CombatRoundLog[] }>;
  combatTargetId: string;
  configReady: boolean;
  consumables: NonNullable<ReturnType<typeof useAppStore.getState>["activeSave"]>["inventory"];
  currentStoryRequest: string | null;
  debugMode: boolean;
  echoNarrative: string;
  echoTitle: string;
  input: string;
  isCombatAnimating: boolean;
  isGenerating: boolean;
  isMenuOpen: boolean;
  isOnline: boolean;
  lastStoryDebug: ReturnType<typeof useAppStore.getState>["lastStoryDebug"];
  lastStoryError: string | null;
  latest: ReturnType<typeof useAppStore.getState>["activeSave"] extends infer Save
    ? Save extends { recentEvents: infer Events }
      ? Events extends Array<infer Event>
        ? Event | undefined
        : never
      : never
    : never;
  livingEnemies: NonNullable<NonNullable<ReturnType<typeof useAppStore.getState>["activeSave"]>["combatState"]>["enemies"];
  menuItems: typeof gameMenuItems;
  menuRef: React.RefObject<HTMLDivElement | null>;
  storyScrollRef: React.RefObject<HTMLDivElement | null>;
  trainingActions: typeof trainingActions;
  trainingStatus: ReturnType<typeof getOfflineTrainingStatus> | null;
  validation: ReturnType<typeof useAppStore.getState>["validation"];
  visibleCombatLogs: CombatRoundLog[];
  visibleEvents: NonNullable<ReturnType<typeof useAppStore.getState>["activeSave"]>["recentEvents"];
  closeModal: () => void;
  handleInputKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => Promise<void>;
  openModal: (panel: GameRuntimeModal) => void;
  setCombatTargetId: (targetId: string) => void;
  setDebugMode: (enabled: boolean) => void;
  setInput: (value: string) => void;
  setIsMenuOpen: (next: boolean | ((current: boolean) => boolean)) => void;
  submitCombatAction: (action: CombatActionInput) => Promise<void>;
  submitNote: () => Promise<void>;
  submitProgress: () => Promise<void>;
  toggleMenu: () => void;
  saveStablePoint: () => Promise<void>;
  applyTrainingAction: (actionId: string) => Promise<void>;
};

export function useGameRuntime(): GameRuntimeState {
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
  const [activeModal, setActiveModal] = useState<GameRuntimeModal>(null);
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
    () => (activeModal && activeModal !== "model-settings" ? getGameMenuItem(activeModal) : null),
    [activeModal],
  );

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

  const scrollStoryToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    storyScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  const submitNote = async () => {
    const current = input.trim();
    if (!current) {
      return;
    }
    setInput("");
    await appendNote(current);
  };

  const handleInputKeyDown = async (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    if (!(event.shiftKey || event.metaKey || event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    await submitProgress();
  };

  return {
    activeSave,
    activeMenuItem,
    activeModal,
    canProgress,
    combat,
    combatActionLocked,
    combatBeatText,
    combatHeadline,
    combatRounds,
    combatTargetId,
    configReady,
    consumables,
    currentStoryRequest,
    debugMode,
    echoNarrative,
    echoTitle,
    input,
    isCombatAnimating,
    isGenerating,
    isMenuOpen,
    isOnline,
    lastStoryDebug,
    lastStoryError,
    latest,
    livingEnemies,
    menuItems: gameMenuItems,
    menuRef,
    storyScrollRef,
    trainingActions,
    trainingStatus,
    validation,
    visibleCombatLogs,
    visibleEvents,
    closeModal: () => setActiveModal(null),
    handleInputKeyDown,
    openModal: (panel) => setActiveModal(panel),
    setCombatTargetId,
    setDebugMode,
    setInput,
    setIsMenuOpen,
    submitCombatAction: performCombatAction,
    submitNote,
    submitProgress,
    toggleMenu: () => setIsMenuOpen((current) => !current),
    saveStablePoint: () => saveToSlot("recent-stable"),
    applyTrainingAction: applyOfflineTraining,
  };
}

