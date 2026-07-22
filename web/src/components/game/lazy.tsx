import { lazy } from "react";

export const LazyNewGamePicker = lazy(async () => {
  const module = await import("@/components/game/NewGamePicker");
  return { default: module.NewGamePicker };
});

export const LazySaveSlotsPanel = lazy(async () => {
  const module = await import("@/components/game/GamePanels");
  return { default: module.SaveSlotsPanel };
});

export const LazyGamePanelContent = lazy(async () => {
  const module = await import("@/components/game/GamePanels");
  return { default: module.GamePanelContent };
});

export const LazyModelSettingsForm = lazy(async () => {
  const module = await import("@/components/game/ModelSettingsForm");
  return { default: module.ModelSettingsForm };
});
