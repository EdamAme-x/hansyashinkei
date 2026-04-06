const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 3;

export async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `rl:${ip}`;
  const raw = await kv.get(key);

  if (!raw) {
    await kv.put(key, "1", { expirationTtl: WINDOW_SECONDS });
    return true;
  }

  const count = parseInt(raw, 10);
  if (count >= MAX_REQUESTS) {
    return false;
  }

  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS });
  return true;
}
