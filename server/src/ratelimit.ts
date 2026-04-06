const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;

const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = windows.get(ip);

  if (!entry || now >= entry.resetAt) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}
