import { Navigate } from "react-router-dom";

/**
 * Keeps the legacy route compatible by redirecting to the home page modal flow.
 */
export default function LlmConfig() {
  return <Navigate to="/" replace />;
}
