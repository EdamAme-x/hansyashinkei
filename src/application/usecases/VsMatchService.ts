import type { GameMode } from "@domain/entities/GameMode";
import { createRoom as apiCreateRoom, getRoomInfo as apiGetRoomInfo, getWsUrl } from "@infrastructure/api/VsApiClient";

export class VsMatchService {
  async createRoom(mode: GameMode): Promise<{ roomId: string; mode: string }> {
    return apiCreateRoom(mode);
  }

  async getRoomInfo(roomId: string): Promise<{ roomId: string; mode: string; state: string; playerCount: number }> {
    return apiGetRoomInfo(roomId);
  }

  getWsUrl(roomId: string): string {
    return getWsUrl(roomId);
  }
}
