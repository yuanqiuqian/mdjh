import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";

const Home = lazy(() => import("@/pages/Home"));
const Game = lazy(() => import("@/pages/Game"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-sm text-stone-400">
      场景加载中…
    </div>
  );
}

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
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/new-game" element={<Navigate to="/" replace />} />
          <Route path="/game/menu" element={<Navigate to="/game" replace />} />
          <Route path="/game/menu/:panel" element={<Navigate to="/game" replace />} />
          <Route path="/codex" element={<Navigate to="/game" replace />} />
          <Route path="/llm-config" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
