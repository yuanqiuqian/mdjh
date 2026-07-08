import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import NewGame from "@/pages/NewGame";
import Game from "@/pages/Game";
import Codex from "@/pages/Codex";
import LlmConfig from "@/pages/LlmConfig";
import { useAppStore } from "@/store/useAppStore";

export default function App() {
  const isHydrated = useAppStore((state) => state.isHydrated);
  const hydrate = useAppStore((state) => state.hydrate);
  const setOnline = useAppStore((state) => state.setOnline);

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [hydrate, isHydrated]);

  useEffect(() => {
    const handle = () => setOnline(navigator.onLine);
    window.addEventListener("online", handle);
    window.addEventListener("offline", handle);
    handle();
    return () => {
      window.removeEventListener("online", handle);
      window.removeEventListener("offline", handle);
    };
  }, [setOnline]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new-game" element={<NewGame />} />
        <Route path="/game" element={<Game />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/llm-config" element={<LlmConfig />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
