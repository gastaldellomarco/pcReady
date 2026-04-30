const KEY = "pcready-theme";
export function initTheme() {
  if (typeof window === "undefined") return;
  const t = localStorage.getItem(KEY) || "light";
  document.documentElement.classList.toggle("dark", t === "dark");
}
export function isDark(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}
export function toggleTheme() {
  const next = isDark() ? "light" : "dark";
  document.documentElement.classList.toggle("dark", next === "dark");
  localStorage.setItem(KEY, next);
}
