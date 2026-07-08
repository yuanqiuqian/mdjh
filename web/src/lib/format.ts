export const formatDateTime = (value?: string) => {
  if (!value) {
    return "尚未记录";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatDelta = (value?: number) => {
  if (!value) {
    return "0";
  }
  return value > 0 ? `+${value}` : `${value}`;
};

export const favorLabel = (favor: number) => {
  if (favor >= 80) return "生死之交";
  if (favor >= 30) return "友好";
  if (favor > -30) return "中立";
  if (favor > -80) return "敌视";
  return "死仇";
};
