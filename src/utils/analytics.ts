/**
 * Vercel Web Analytics wrapper.
 *
 * The analytics script is injected via index.html and is a no-op in
 * non-Vercel environments (local dev, other hosts).
 *
 * See: https://vercel.com/docs/analytics
 */

declare global {
  interface Window {
    va?: (
      event: "event" | "pageview",
      properties?: Record<string, unknown>
    ) => void;
    vaq?: unknown[];
  }
}

/**
 * Track a custom event with Vercel Analytics.
 * Silently dropped when not running on Vercel.
 */
export function track(
  name: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  window.va?.("event", { name, ...properties });
}
