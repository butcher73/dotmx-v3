/**
 * Build a query string from an object of optional params.
 * Numbers are converted to strings; undefined/null values are skipped.
 */
export function buildQueryString(
  params: Record<string, string | number | undefined | null>
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
