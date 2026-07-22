import { Navigate } from "react-router-dom";
import { useIsHandset } from "@/hooks/useIsHandset";

export default function GameRouteEntry() {
  const isHandset = useIsHandset();
  return <Navigate to={isHandset ? "/game/mobile" : "/game/desktop"} replace />;
}

