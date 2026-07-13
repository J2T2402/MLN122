import express from "express";
import cors from "cors";
import path from "path";
import { config } from "../config/env";
import { createRoom } from "../rooms/factory";
import { roomStore } from "../rooms/store";

export const app = express();

// Set up CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json());

// --- Lightweight abuse guard for the (unauthenticated) create-room endpoint ---
// Prevents a single client from spawning unbounded rooms and exhausting server RAM.
const MAX_ACTIVE_ROOMS = Number(process.env.MAX_ACTIVE_ROOMS ?? 500);
const CREATE_ROOM_WINDOW_MS = Number(process.env.CREATE_ROOM_WINDOW_MS ?? 60_000);
const CREATE_ROOM_MAX_PER_WINDOW = Number(process.env.CREATE_ROOM_MAX_PER_WINDOW ?? 100);
const createRoomHits = new Map<string, number[]>();

// API route to create a room
app.post("/api/create-room", (req, res) => {
  try {
    // Global cap on live rooms.
    const liveRooms = Array.from(roomStore.all()).length;
    if (liveRooms >= MAX_ACTIVE_ROOMS) {
      return res.status(503).json({ error: "SERVER_BUSY" });
    }

    // Per-IP sliding-window rate limit.
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const now = Date.now();
    const hits = (createRoomHits.get(ip) || []).filter((t) => now - t < CREATE_ROOM_WINDOW_MS);
    if (hits.length >= CREATE_ROOM_MAX_PER_WINDOW) {
      return res.status(429).json({ error: "RATE_LIMITED" });
    }
    hits.push(now);
    createRoomHits.set(ip, hits);

    const room = createRoom();
    res.json({
      roomCode: room.roomCode,
      hostToken: room.hostSecret,
    });
  } catch (err: any) {
    console.error("Failed to create room:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Health-checks
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.get("/readyz", (req, res) => {
  res.status(200).send("OK");
});

// Serve frontend build static files in production
const clientBuildPath = path.resolve(__dirname, "../../../client/dist");
app.use(express.static(clientBuildPath));

// Fallback all other routes to frontend SPA router
app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"), (err) => {
    if (err) {
      // If client not built yet, return simple message
      res.status(200).send("Hành Trình Định Hướng Server is running. Client build not found.");
    }
  });
});
