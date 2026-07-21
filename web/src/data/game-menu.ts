export const gameMenuItems = [
  {
    id: "character",
    label: "个人状态",
    description: "查看等级、属性和当前状态。",
  },
  {
    id: "inventory",
    label: "背包",
    description: "整理装备、药品和任务物品。",
  },
  {
    id: "relations",
    label: "关系",
    description: "查看人物好感和交互变化。",
  },
  {
    id: "logs",
    label: "日志",
    description: "回看剧情记录和关键事件。",
  },
  {
    id: "saves",
    label: "存档",
    description: "读取、覆盖和整理存档位。",
  },
  {
    id: "system",
    label: "系统",
    description: "查看模型接入、导出与调试入口。",
  },
] as const;

export type GameMenuPanel = (typeof gameMenuItems)[number]["id"];

/**
 * Returns a safe menu panel id from the route param, falling back to character.
 */
export const resolveGameMenuPanel = (panel?: string): GameMenuPanel =>
  gameMenuItems.find((item) => item.id === panel)?.id ?? "character";

/**
 * Resolves the display metadata for a game submenu panel.
 */
export const getGameMenuItem = (panel?: string) =>
  gameMenuItems.find((item) => item.id === resolveGameMenuPanel(panel)) ?? gameMenuItems[0];
