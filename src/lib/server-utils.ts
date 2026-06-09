import { getRequest } from "@tanstack/react-start/server";

/**
 * Returns the base URL of the application.
 * Dynamically resolves the origin of the active request if available.
 */
export function getAppBaseUrl(): string {
  try {
    const request = getRequest();
    if (request && request.url) {
      const url = new URL(request.url);
      return url.origin;
    }
  } catch (_error) {
    // Context is not an active web request (e.g. tests or background scripts)
  }
  return process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:3000";
}
