import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateRoomId } from "@server/auth";
import { checkRateLimit } from "@server/ratelimit";
import type { GameMode } from "@domain/entities/GameMode";

export { RoomDurableObject } from "@server/room";

interface Env {
  ROOM: DurableObjectNamespace;
  RATE_LIMIT: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({
  origin: ["https://hs.evex.land", "http://localhost:5173", "http://localhost:4173", "https://hs-vs-server.edamamex.workers.dev"],
  allowMethods: ["GET", "POST"],
  allowHeaders: ["Content-Type"],
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type export for hono/client RPC
const routes = app
  // Create a new room
  .post("/api/rooms", async (c) => {
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
    if (!await checkRateLimit(c.env.RATE_LIMIT, ip)) {
      return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
    }

    const body = await c.req.json<{ mode?: GameMode }>().catch(() => ({} as { mode?: GameMode }));
    const mode: GameMode = body.mode === "triple" ? "triple" : "classic";
    const roomId = generateRoomId();

    const doId = c.env.ROOM.idFromName(roomId);
    const stub = c.env.ROOM.get(doId);
    await stub.fetch(new Request("https://internal/init", {
      method: "POST",
      body: JSON.stringify({ mode, roomId }),
    }));

    return c.json({ roomId, mode });
  })

  // Room info
  .get("/api/rooms/:id", async (c) => {
    const roomId = c.req.param("id").toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(roomId)) {
      return c.json({ error: "Invalid room ID" }, 400);
    }

    const doId = c.env.ROOM.idFromName(roomId);
    const stub = c.env.ROOM.get(doId);
    const res = await stub.fetch(new Request("https://internal/info"));
    return new Response(res.body, { headers: res.headers, status: res.status });
  })

  // WebSocket upgrade
  .get("/api/rooms/:id/ws", async (c) => {
    const roomId = c.req.param("id").toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(roomId)) {
      return c.json({ error: "Invalid room ID" }, 400);
    }

    const upgradeHeader = c.req.header("Upgrade");
    if (upgradeHeader !== "websocket") {
      return c.json({ error: "Expected WebSocket" }, 426);
    }

    const doId = c.env.ROOM.idFromName(roomId);
    const stub = c.env.ROOM.get(doId);
    return stub.fetch(new Request("https://internal/ws", {
      headers: c.req.raw.headers,
    }));
  })

  // Health check
  .get("/api/health", (c) => c.json({ ok: true }));

export type AppType = typeof routes;
export default app;
