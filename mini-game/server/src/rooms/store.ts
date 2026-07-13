import { Room, Player } from "../types/domain";

class RoomStore {
  private rooms = new Map<string, Room>(); // roomCode -> Room

  public create(room: Room): void {
    this.rooms.set(room.roomCode, room);
  }

  public get(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public delete(roomCode: string): boolean {
    return this.rooms.delete(roomCode.toUpperCase());
  }

  public all(): IterableIterator<Room> {
    return this.rooms.values();
  }

  public findByHostToken(token: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.hostSecret === token) {
        return room;
      }
    }
    return undefined;
  }

  public findPlayerByReconnectToken(token: string): { room: Room; player: Player } | undefined {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.reconnectToken === token) {
          return { room, player };
        }
      }
    }
    return undefined;
  }
}

export const roomStore = new RoomStore();
