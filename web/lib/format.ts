export function label(value?: string | null): string {
  return value
    ? value.replaceAll("_", " ").replace(/^\w/, (s) => s.toUpperCase())
    : "Not recorded";
}
export function safeUrl(value?: string | null): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* Missing or unsupported references stay plain text. */
  }
}
export function date(value?: string | null): string {
  if (!value) return "Not recorded";
  const d = new Date(value.length === 10 ? value + "T12:00:00Z" : value);
  return Number.isNaN(d.getTime())
    ? "Not recorded"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
export function age(value?: string | null, now = Date.now()): string {
  if (!value) return "Date not recorded";
  const t = new Date(
    value.length === 10 ? value + "T12:00:00Z" : value,
  ).getTime();
  if (!Number.isFinite(t)) return "Date not recorded";
  const days = Math.floor((now - t) / 86_400_000);
  if (days < 0) return "Future date recorded";
  return days === 0 ? "Today" : days === 1 ? "1 day ago" : days + " days ago";
}
export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
export function humanText(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;
  for (const key of [
    "title",
    "name",
    "headline",
    "summary",
    "story_title",
    "result",
    "action",
  ]) {
    if (typeof record[key] === "string" && record[key])
      return record[key] as string;
  }
  for (const key of [
    "evidence_story",
    "project",
    "skill",
    "company_intelligence",
  ]) {
    const nested = humanText(record[key]);
    if (nested) return nested;
  }
}
