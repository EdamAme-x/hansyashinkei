const VS_SERVER_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_VS_SERVER_URL ?? "https://vs.hs.evex.land";

export async function createRoom(mode: "classic" | "triple"): Promise<{ roomId: string; mode: string }> {
  const res = await fetch(`${VS_SERVER_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ roomId: string; mode: string }>;
}

export async function getRoomInfo(roomId: string): Promise<{
  roomId: string; mode: string; state: string; playerCount: number;
}> {
  const res = await fetch(`${VS_SERVER_URL}/api/rooms/${roomId}`);
  if (!res.ok) throw new Error(`Room not found: ${roomId}`);
  return res.json() as Promise<{ roomId: string; mode: string; state: string; playerCount: number }>;
}

export function getWsUrl(roomId: string): string {
  const proto = VS_SERVER_URL.startsWith("https") ? "wss" : "ws";
  const host = VS_SERVER_URL.replace(/^https?:\/\//, "");
  return `${proto}://${host}/api/rooms/${roomId}/ws`;
}
