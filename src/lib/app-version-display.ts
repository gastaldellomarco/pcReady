import { version as appVersion } from "@root/package.json";

export { appVersion };

/** From VITE_DEPLOYMENT_LABEL; empty when unset or whitespace-only. */
export function viteDeploymentLabel(): string {
  return typeof import.meta.env.VITE_DEPLOYMENT_LABEL === "string"
    ? import.meta.env.VITE_DEPLOYMENT_LABEL.trim()
    : "";
}
