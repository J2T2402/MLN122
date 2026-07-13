import { io as ClientIO } from "socket.io-client";
import http from "http";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function runSimulation() {
  console.log("=========================================");
  console.log("STARTING SIMULATION LOAD TEST...");
  console.log("=========================================");

  // 1. Create Room via API
  const createRoom = (): Promise<{ roomCode: string; hostToken: string }> => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        `${BASE_URL}/api/create-room`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(JSON.parse(data)));
        }
      );
      req.on("error", reject);
      req.end();
    });
  };

  try {
    const { roomCode, hostToken } = await createRoom();
    console.log(`✓ Created Room: ${roomCode} with Host Token: ${hostToken}`);

    // 2. Connect MC (Host)
    const hostSocket = ClientIO(BASE_URL, {
      auth: { hostToken },
      transports: ["websocket"],
    });

    hostSocket.on("connect", () => {
      console.log("✓ Host Socket Connected");
      hostSocket.emit("joinRoom", { roomCode, role: "host" }, (ack: any) => {
        console.log("✓ Host Joined Room Status:", ack);
      });
    });

    // 3. Connect 3 Simulated Players
    const playersInfo = [
      { name: "Thủy Thủ Tinh Anh", teamId: 1, answers: { q1: { type: "mcq", optionId: "B" }, q11: { type: "selectwrong", optionId: "C" } } },
      { name: "Sóng Bạc Vượt Sóng", teamId: 2, answers: { q1: { type: "mcq", optionId: "A" }, q11: { type: "selectwrong", optionId: "C" } } },
      { name: "Hải Đăng Dẫn Đường", teamId: 3, answers: { q1: { type: "mcq", optionId: "B" }, q11: { type: "selectwrong", optionId: "A" } } }
    ];

    const playerSockets: any[] = [];

    for (let i = 0; i < playersInfo.length; i++) {
      const pInfo = playersInfo[i];
      const pSocket = ClientIO(BASE_URL, { transports: ["websocket"] });

      pSocket.on("connect", () => {
        pSocket.emit("joinRoom", { roomCode, role: "player" }, (ack: any) => {
          console.log(`✓ Player ${i + 1} Joined:`, ack.playerId);
          
          // Set nickname
          pSocket.emit("setNickname", { nickname: pInfo.name, avatar: "🐬" });
          
          // Team is auto-assigned by the server on join.
        });
      });

      playerSockets.push(pSocket);
    }

    // Wait 2s for connections to stabilize, then run stepper
    await sleep(2000);

    // MC starts game
    console.log("\n--- MC: START GAME ---");
    hostSocket.emit("startGame", { roomCode });
    await sleep(1500);

    // MC opens Station 1
    console.log("\n--- MC: OPEN STATION 1 ---");
    hostSocket.emit("openStation", { station: 1 });
    await sleep(1500);

    // MC starts answering
    console.log("\n--- MC: START ANSWERING Q1 ---");
    hostSocket.emit("startAnswering", { questionId: "t1-q1" });
    await sleep(1000);

    // Players submit answers
    console.log("\n--- PLAYERS: SUBMIT ANSWERS ---");
    playerSockets[0].emit("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" } }, (res: any) => console.log("Sub 1 ack:", res));
    playerSockets[1].emit("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "B" } }, (res: any) => console.log("Sub 2 ack:", res));
    playerSockets[2].emit("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" } }, (res: any) => console.log("Sub 3 ack:", res));
    await sleep(1500);

    // MC locks answers
    console.log("\n--- MC: LOCK ANSWERS ---");
    hostSocket.emit("lockAnswers", { questionId: "t1-q1" });
    await sleep(1000);

    // MC reveals answers
    console.log("\n--- MC: REVEAL ANSWERS ---");
    hostSocket.emit("revealAnswer", { questionId: "t1-q1" });
    await sleep(1500);

    // MC shows Knowledge Card
    console.log("\n--- MC: SHOW KNOWLEDGE CARD ---");
    hostSocket.emit("showKnowledgeCard", { questionId: "t1-q1" });
    await sleep(1500);

    // MC shows Leaderboard
    console.log("\n--- MC: SHOW LEADERBOARD ---");
    hostSocket.emit("showLeaderboard");
    await sleep(1500);

    // MC: Close room
    console.log("\n--- MC: END GAME ---");
    hostSocket.emit("endGame");
    await sleep(1500);

    // Cleanup
    hostSocket.disconnect();
    playerSockets.forEach(s => s.disconnect());
    console.log("\n=========================================");
    console.log("SIMULATION COMPLETED SUCCESSFUL!");
    console.log("=========================================");
    process.exit(0);

  } catch (err) {
    console.error("Simulation failed:", err);
    process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runSimulation();
