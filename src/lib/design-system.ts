export const pcReadyColors = {
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  primaryLight: "#DBEAFE",
  success: "#16A34A",
  successHover: "#15803D",
  successLight: "#DCFCE7",
  warning: "#D97706",
  warningLight: "#FEF3C7",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  info: "#0D9488",
  infoLight: "#CCFBF1",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  surface: "#F8FAFC",
  card: "#FFFFFF",
  overlay: "#020617",
  slateLight: "#F1F5F9",
} as const;

export const pcReadyDarkColors = {
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  border: "#1E293B",
  surface: "#0F172A",
  card: "#1E293B",
  primaryLight: "#1E3A5F",
} as const;

export const pcReadyChartColors = [
  pcReadyColors.primary,
  pcReadyColors.success,
  pcReadyColors.info,
  pcReadyColors.warning,
  pcReadyColors.danger,
  pcReadyColors.purple,
] as const;

export const pcReadyStatusTokens = {
  pending: { color: pcReadyColors.warning, background: pcReadyColors.warningLight },
  inProgress: { color: pcReadyColors.primary, background: pcReadyColors.primaryLight },
  completed: { color: pcReadyColors.success, background: pcReadyColors.successLight },
  archived: { color: pcReadyColors.textSecondary, background: pcReadyColors.slateLight },
  critical: { color: pcReadyColors.danger, background: pcReadyColors.dangerLight },
  info: { color: pcReadyColors.info, background: pcReadyColors.infoLight },
} as const;
