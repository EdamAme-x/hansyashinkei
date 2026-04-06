import type { ClientMessage, ServerMessage } from "@shared/protocol";

export type WsHandler = (msg: ServerMessage) => void;

function xorDecrypt(key: Uint8Array, encoded: string): string {
  const bin = atob(encoded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  return new TextDecoder().decode(out);
}

export class WsClient {
  private ws: WebSocket | null = null;
  private handler: WsHandler | null = null;
  private closeHandler: (() => void) | null = null;
  private decryptKey: Uint8Array | null = null;

  onMessage(handler: WsHandler): void { this.handler = handler; }
  onClose(handler: () => void): void { this.closeHandler = handler; }

  /** Set the XOR key for decrypting encrypted messages. */
  setDecryptKey(key: Uint8Array): void { this.decryptKey = key; }

  connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket connection failed"));

      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return;
        try {
          const raw = JSON.parse(ev.data) as ServerMessage;
          if (raw.type === "encrypted" && this.decryptKey) {
            const decrypted = xorDecrypt(this.decryptKey, raw.data);
            const inner = JSON.parse(decrypted) as ServerMessage;
            this.handler?.(inner);
          } else {
            this.handler?.(raw);
          }
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
