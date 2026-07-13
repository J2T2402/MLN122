/** 30-player concurrent load smoke — NFR1 (30 đồng thời) + rủi ro "vỡ trận". */
import { io as ClientIO } from "socket.io-client";
import http from "http";
const BASE = "http://localhost:3000";
const N = 30;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const createRoom = (): Promise<{ roomCode: string; hostToken: string }> => new Promise((res, rej) => {
  const req = http.request(`${BASE}/api/create-room`, { method: "POST", headers: { "Content-Type": "application/json" } },
    r => { let d = ""; r.on("data", c => d += c); r.on("end", () => res(JSON.parse(d))); }); req.on("error", rej); req.end();
});

(async () => {
  const t0 = Date.now();
  const { roomCode, hostToken } = await createRoom();
  const host = ClientIO(BASE, { transports: ["websocket"], auth: { hostToken } });
  await new Promise<void>(r => host.on("connect", () => r()));
  await new Promise<void>(r => host.emit("joinRoom", { roomCode, role: "host" }, () => r()));

  let connectErrors = 0, joinErrors = 0, submitOk = 0, submitErr = 0;
  const players: any[] = [];
  const connectStart = Date.now();
  await Promise.all(Array.from({ length: N }, (_, i) => new Promise<void>((resolve) => {
    const s = ClientIO(BASE, { transports: ["websocket"], forceNew: true });
    s.on("connect_error", () => { connectErrors++; resolve(); });
    s.on("connect", () => {
      s.emit("joinRoom", { roomCode, role: "player" }, (ack: any) => {
        if (!ack?.ok) { joinErrors++; return resolve(); }
        s.emit("setNickname", { nickname: `SV${i + 1}` });
        players.push({ s, teamId: (i % 6) + 1 });
        resolve();
      });
    });
  })));
  const connectMs = Date.now() - connectStart;
  console.log(`Connected+joined ${players.length}/${N} players in ${connectMs}ms (connectErr=${connectErrors}, joinErr=${joinErrors})`);

  host.emit("startGame", { roomCode });
  await sleep(600);
  host.emit("openStation", { station: 1 });
  await sleep(500);
  host.emit("startAnswering", { questionId: "t1-q1" });
  await sleep(400);

  // all 30 submit near-simultaneously
  const subStart = Date.now();
  await Promise.all(players.map((p, i) => new Promise<void>((resolve) => {
    p.s.emit("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: ["A", "B", "C", "D"][i % 4] }, clientSentAt: Date.now() },
      (ack: any) => { ack?.ok ? submitOk++ : submitErr++; resolve(); });
  })));
  const submitMs = Date.now() - subStart;
  console.log(`30 concurrent submits: ok=${submitOk} err=${submitErr} in ${submitMs}ms`);

  // measure leaderboard broadcast round-trip
  await sleep(300);
  let gotLb = false; const lbStart = Date.now();
  players[0].s.on("leaderboardUpdate", () => { if (!gotLb) { gotLb = true; console.log(`leaderboard reached player in ${Date.now() - lbStart}ms after reveal`); } });
  host.emit("lockAnswers", { questionId: "t1-q1" });
  await sleep(300);
  host.emit("revealAnswer", { questionId: "t1-q1" });
  await sleep(300);
  host.emit("showLeaderboard");
  await sleep(800);

  const pass = players.length === N && submitOk === N && submitErr === 0 && connectErrors === 0 && joinErrors === 0;
  console.log(`\nRESULT: ${pass ? "PASS ✓" : "CHECK ⚠"}  (players=${players.length}/${N}, submitOk=${submitOk}/${N}, totalTime=${Date.now() - t0}ms)`);
  host.disconnect(); players.forEach(p => p.s.disconnect());
  process.exit(pass ? 0 : 1);
})();
