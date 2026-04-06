import type { ClientMessage, ServerMessage } from "@shared/protocol";

export type WsHandler = (msg: ServerMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private handler: WsHandler | null = null;
  private closeHandler: (() => void) | null = null;

  onMessage(handler: WsHandler): void { this.handler = handler; }
  onClose(handler: () => void): void { this.closeHandler = handler; }

  connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket connection failed"));

      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return;
        try {
          this.handler?.(JSON.parse(ev.data) as ServerMessage);
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        this.ws = null;
        this.closeHandler?.();
      };
    });
  }

  send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
