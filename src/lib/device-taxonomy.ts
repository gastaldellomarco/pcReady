export const DEVICE_CATEGORIES = [
  "endpoint",
  "printing",
  "network",
  "server_infra",
  "mobile",
  "peripheral",
] as const;

/**
 *
 */
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export const DEVICE_CATEGORY_LABELS: Record<DeviceCategory, string> = {
  endpoint: "Endpoint",
  printing: "Printing",
  network: "Network",
  server_infra: "Server / Infra",
  mobile: "Mobile",
  peripheral: "Peripheral",
};

export const DEVICE_TYPES_BY_CATEGORY: Record<DeviceCategory, string[]> = {
  endpoint: ["Desktop", "Laptop", "Mini PC", "Workstation"],
  printing: ["Stampante", "Multifunzione", "Etichettatrice"],
  network: ["Router", "Switch", "Firewall", "Access Point"],
  server_infra: ["Server", "NAS", "UPS", "Storage"],
  mobile: ["Smartphone", "Tablet"],
  peripheral: ["Monitor", "Dock", "Scanner", "Lettore barcode"],
};

export const MVP_DEVICE_TYPES_BY_CATEGORY: Record<DeviceCategory, string[]> = {
  endpoint: ["Desktop", "Laptop"],
  printing: ["Stampante", "Multifunzione"],
  network: ["Router", "Switch", "Firewall", "Access Point"],
  server_infra: ["Server", "NAS"],
  mobile: DEVICE_TYPES_BY_CATEGORY.mobile,
  peripheral: DEVICE_TYPES_BY_CATEGORY.peripheral,
};

export const DEFAULT_DEVICE_CATEGORY: DeviceCategory = "endpoint";
export const DEFAULT_DEVICE_TYPE = "Desktop";

/**
 *
 */
export function isDeviceCategory(value: unknown): value is DeviceCategory {
  return typeof value === "string" && DEVICE_CATEGORIES.includes(value as DeviceCategory);
}

/**
 *
 */
export function getDeviceTypes(category: DeviceCategory, mvpOnly = false) {
  return mvpOnly ? MVP_DEVICE_TYPES_BY_CATEGORY[category] : DEVICE_TYPES_BY_CATEGORY[category];
}

/**
 *
 */
export function getDeviceCategoryLabel(category?: string | null) {
  return isDeviceCategory(category) ? DEVICE_CATEGORY_LABELS[category] : category || "Endpoint";
}

/**
 *
 */
export function getDeviceTypeLabel(type?: string | null) {
  return type?.trim() || DEFAULT_DEVICE_TYPE;
}
