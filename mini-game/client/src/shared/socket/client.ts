import { io, Socket } from "socket.io-client";
import { ServerToClient, ClientToServer } from "./events";

// Typed socket client matching contract in events.ts
export const socket: Socket<ServerToClient, ClientToServer> = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});
