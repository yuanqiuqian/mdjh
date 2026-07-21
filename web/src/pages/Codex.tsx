import { Navigate } from "react-router-dom";

/**
 * Keeps the legacy route compatible by redirecting back to the current story.
 */
export default function Codex() {
  return <Navigate to="/game" replace />;
}
