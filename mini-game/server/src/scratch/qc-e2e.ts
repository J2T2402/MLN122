/**
 * QC END-TO-END TEST HARNESS — "Hành Trình Định Hướng"
 * Senior QC automated E2E suite. Drives the LIVE server on :3000 via Socket.io
 * as host + screen + players, asserting every branch: full game (5 trạm + Boss),
 * scoring/combo/boss-x2, anti-cheat, reconnect, pause/resume, validation, edge cases.
 *
 * Run:  npx ts-node --transpile-only src/scratch/qc-e2e.ts
 */
import { io as ClientIO, Socket } from "socket.io-client";
import http from "http";
import { gradeAnswer } from "../scoring/grade";
import { calculatePoints } from "../scoring/points";
import { getStationQuestionList, getQuestionFull } from "../questions/repo";

const BASE = "http://localhost:3000";

// ---- Data-driven answer builders (robust to questions.json reordering) ----
// The played question per station is stationQuestionIds[station][0]. We read the FULL
// question (with answer key) from the server bank to build correct/wrong submissions,
// so the suite never hard-codes answers and survives any reorder of the bank.
function playedQid(station: any): string { return getStationQuestionList(station)[0]; }
function correctAnswer(q: any): any {
  switch (q.type) {
    case "mcq": return { type: "mcq", optionId: q.correct };
    case "selectwrong": return { type: "selectwrong", optionId: q.correct };
    case "truefalse": { const answers: any = {}; for (const s of q.statements) answers[s.id] = s.isTrue; return { type: "truefalse", answers }; }
    case "dragdrop": case "matching": { const placement: any = {}; for (const it of q.items) placement[it.id] = it.correctBucket; return { type: q.type, placement }; }
  }
}
function wrongAnswer(q: any): any {
  switch (q.type) {
    case "mcq": case "selectwrong": { const other = q.options.find((o: any) => o.id !== q.correct) || q.options[0]; return { type: q.type, optionId: other.id }; }
    case "truefalse": { const answers: any = {}; for (const s of q.statements) answers[s.id] = !s.isTrue; return { type: "truefalse", answers }; }
    case "dragdrop": case "matching": { const placement: any = {}; for (const it of q.items) { const w = q.buckets.find((b: any) => b.id !== it.correctBucket) || q.buckets[0]; placement[it.id] = w.id; } return { type: q.type, placement }; }
  }
}

let PASS = 0, FAIL = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { PASS++; console.log("   ✓ " + name); }
  else { FAIL++; failures.push(name + (extra ? "  ::  " + extra : "")); console.log("   ✗ FAIL: " + name + (extra ? "  ::  " + extra : "")); }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function createRoom(): Promise<{ roomCode: string; hostToken: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}/api/create-room`, { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d))); });
    req.on("error", reject); req.end();
  });
}

class C {
  socket: Socket;
  private buf = new Map<string, any[]>();
  playerId?: string;
  reconnectToken?: string;
  constructor(opts: any = {}) {
    this.socket = ClientIO(BASE, { transports: ["websocket"], forceNew: true, ...opts });
    this.socket.onAny((ev: string, payload: any) => {
      if (!this.buf.has(ev)) this.buf.set(ev, []);
      this.buf.get(ev)!.push(payload);
    });
  }
  connect(): Promise<void> { return new Promise(res => { this.socket.on("connect", () => res()); }); }
  emitAck(ev: string, payload?: any, timeout = 4000): Promise<any> {
    return new Promise((resolve) => {
      const to = setTimeout(() => resolve({ __timeout: true }), timeout);
      this.socket.emit(ev, payload, (ack: any) => { clearTimeout(to); resolve(ack); });
    });
  }
  emit(ev: string, payload?: any) { this.socket.emit(ev, payload); }
  last(ev: string): any { const a = this.buf.get(ev); return a && a.length ? a[a.length - 1] : undefined; }
  all(ev: string): any[] { return this.buf.get(ev) || []; }
  // last answerRevealed for a question that actually carries a private yourResult
  resultFor(qId: string): any { return this.all("answerRevealed").filter(r => r.questionId === qId && r.yourResult).pop(); }
  count(ev: string): number { return (this.buf.get(ev) || []).length; }
  clear(ev: string) { this.buf.set(ev, []); }
  waitFor(ev: string, pred: (p: any) => boolean = () => true, timeout = 5000): Promise<any> {
    const existing = (this.buf.get(ev) || []).find(pred);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => { this.socket.off(ev, h); reject(new Error(`timeout waiting '${ev}'`)); }, timeout);
      const h = (payload: any) => { if (pred(payload)) { clearTimeout(to); this.socket.off(ev, h); resolve(payload); } };
      this.socket.on(ev, h);
    });
  }
  disconnect() { this.socket.disconnect(); }
}

async function joinPlayer(roomCode: string, nickname: string): Promise<C> {
  const c = new C();
  await c.connect();
  const ack = await c.emitAck("joinRoom", { roomCode, role: "player" });
  c.playerId = ack.playerId; c.reconnectToken = ack.reconnectToken;
  c.emit("setNickname", { nickname });
  return c;
}

// =====================================================================================
async function partA_fullGame() {
  console.log("\n=== PART A: FULL GAME — 5 trạm + Boss, chấm điểm, combo, boss x2, victory ===");
  const { roomCode, hostToken } = await createRoom();
  const host = new C({ auth: { hostToken } });
  await host.connect();
  const hAck = await host.emitAck("joinRoom", { roomCode, role: "host" });
  check("A0 host join ok", hAck?.ok === true, JSON.stringify(hAck));

  const screen = new C();
  await screen.connect();
  const sAck = await screen.emitAck("joinRoom", { roomCode, role: "screen" });
  check("A0 screen join ok", sAck?.ok === true, JSON.stringify(sAck));

  const p1 = await joinPlayer(roomCode, "An");
  const p2 = await joinPlayer(roomCode, "Bình");
  const p3 = await joinPlayer(roomCode, "Cường");
  check("A0 players got playerId + reconnectToken", !!p1.playerId && !!p1.reconnectToken && !!p2.playerId && !!p3.playerId);

  // playerList reflects 3 players
  const pl = await screen.waitFor("playerList", (p) => p.counts.total >= 3);
  check("A0 playerList total=3", pl.counts.total === 3, "total=" + pl.counts.total);

  // START GAME -> TEAM_SELECT
  host.emit("startGame", { roomCode });
  await screen.waitFor("roomState", s => s.phase === "TEAM_SELECT");
  check("A1 startGame -> TEAM_SELECT", true);

  // Teams are AUTO-ASSIGNED (balanced) on join — players no longer self-select. Read An's ACTUAL
  // team so the team/winner assertions below derive from the real assignment, not a hard-coded id.
  const ta1 = await p1.waitFor("teamAssigned");
  check("A1 teamAssigned has teamName", !!ta1.teamName, JSON.stringify(ta1));
  const anTeamId = ta1.teamId;
  await sleep(200);

  // Helper to run a station question
  async function runStation(opts: {
    label: string; station: any; qId: string;
    answers: { c: C; ans: any }[];
    expectCorrect: (correct: any) => boolean;
    leakCheck: (q: any) => boolean;
    advance: "next" | "boss" | "endAfterLeaderboard";
  }) {
    host.emit("openStation", { station: opts.station });
    const so = await screen.waitFor("stationOpened", q => q.question.questionId === opts.qId, 6000);
    check(`${opts.label} stationOpened qId=${opts.qId}`, so.question.questionId === opts.qId);
    check(`${opts.label} NO answer leak in public question`, opts.leakCheck(so.question),
      "keys=" + JSON.stringify(Object.keys(so.question)) + " | " + JSON.stringify(so.question).slice(0, 200));

    host.emit("startAnswering", { questionId: opts.qId });
    await screen.waitFor("roomState", s => s.phase === "ANSWERING" || s.phase === "BOSS_ANSWERING", 6000);
    await screen.waitFor("timerSync", t => t.questionId === opts.qId, 4000);
    check(`${opts.label} startAnswering -> timerSync`, true);

    // submit answers (with a speed gap on the first two correct submitters if >1)
    for (let i = 0; i < opts.answers.length; i++) {
      const { c, ans } = opts.answers[i];
      const ack = await c.emitAck("submitAnswer", { questionId: opts.qId, answer: ans, clientSentAt: Date.now() });
      check(`${opts.label} submit ack ok (${(c as any)._nm || i})`, ack?.ok === true && ack?.received === true, JSON.stringify(ack));
      if (i === 0) await sleep(400); // create a speed differential
    }

    // lock (may be a no-op if auto-locked); then wait LOCKED
    host.emit("lockAnswers", { questionId: opts.qId });
    await screen.waitFor("roomState", s => s.phase === "LOCKED", 6000);

    // reveal
    host.emit("revealAnswer", { questionId: opts.qId });
    const rev = await screen.waitFor("answerRevealed", r => r.questionId === opts.qId, 6000);
    check(`${opts.label} revealed correct answer`, opts.expectCorrect(rev.correct), JSON.stringify(rev.correct));
    check(`${opts.label} stats.classCorrectPct present`, typeof rev.stats?.classCorrectPct === "number", JSON.stringify(rev.stats));

    // knowledge card
    host.emit("showKnowledgeCard", { questionId: opts.qId });
    const kc = await screen.waitFor("knowledgeCard", k => k.questionId === opts.qId, 6000);
    check(`${opts.label} knowledgeCard has body+explain`, !!kc.knowledgeCard?.body && !!kc.explain);

    // leaderboard
    host.emit("showLeaderboard");
    const lb = await screen.waitFor("leaderboardUpdate", () => true, 6000);
    check(`${opts.label} leaderboard players+teams+ships`, Array.isArray(lb.players) && Array.isArray(lb.teams) && lb.shipPositions.length === 6);
    screen.clear("leaderboardUpdate");

    return rev;
  }

  // ---- STATION 1 (mcq, correct A) ----
  (p1 as any)._nm = "An"; (p2 as any)._nm = "Bình"; (p3 as any)._nm = "Cường";
  await runStation({
    label: "A-T1", station: 1, qId: "t1-q1",
    answers: [
      { c: p1, ans: { type: "mcq", optionId: "A" } },   // correct, fast
      { c: p2, ans: { type: "mcq", optionId: "B" } },   // wrong
      { c: p3, ans: { type: "mcq", optionId: "A" } },   // correct, slower
    ],
    expectCorrect: (c) => c.optionId === "A",
    leakCheck: (q) => q.correct === undefined && (q.options || []).every((o: any) => o.isCorrect === undefined && o.correct === undefined),
    advance: "next",
  });
  const p1r1 = p1.resultFor("t1-q1");
  const p2r1 = p2.resultFor("t1-q1");
  const p3r1 = p3.resultFor("t1-q1");
  check("A-T1 p1 correct, points>0, streak=1", p1r1?.yourResult?.isCorrect === true && p1r1.yourResult.pointsEarned > 0 && p1r1.yourResult.streak === 1, JSON.stringify(p1r1?.yourResult));
  check("A-T1 p2 wrong, points=0, streak=0", p2r1?.yourResult?.isCorrect === false && p2r1.yourResult.pointsEarned === 0 && p2r1.yourResult.streak === 0, JSON.stringify(p2r1?.yourResult));
  check("A-T1 SPEED: p1(fast) >= p3(slow), both correct", p1r1.yourResult.pointsEarned >= p3r1.yourResult.pointsEarned && p3r1.yourResult.isCorrect === true, `p1=${p1r1.yourResult.pointsEarned} p3=${p3r1.yourResult.pointsEarned}`);

  host.emit("nextStation");
  await screen.waitFor("roomState", s => s.phase === "STATION_OPEN" && s.currentStation === 2, 6000);

  // ---- STATION 2 (truefalse) correct s1:false s2:true s3:true ----
  await runStation({
    label: "A-T2", station: 2, qId: "t2-q1",
    answers: [
      { c: p1, ans: { type: "truefalse", answers: { s1: false, s2: true, s3: true } } }, // full correct -> streak 2
      { c: p2, ans: { type: "truefalse", answers: { s1: true, s2: true, s3: true } } },  // 2/3 -> not correct
      // p3 does NOT submit -> streak reset, 0 pts
    ],
    expectCorrect: (c) => c.statements && c.statements.s1 === false && c.statements.s2 === true && c.statements.s3 === true,
    leakCheck: (q) => (q.statements || []).every((s: any) => s.isTrue === undefined) && q.correct === undefined,
    advance: "next",
  });
  const p1r2 = p1.resultFor("t2-q1"); const p2r2 = p2.resultFor("t2-q1"); const p3r2 = p3.resultFor("t2-q1");
  // Observation: non-submitter (p3) should still get a private yourResult(0). Also record double-emit.
  check("A-T2 non-submitter p3 received a private yourResult(0)", !!p3r2 && p3r2.yourResult?.pointsEarned === 0, JSON.stringify(p3r2?.yourResult));
  check("A-T2 COMBO: p1 streak=2 (2 consecutive correct)", p1r2?.yourResult?.streak === 2, JSON.stringify(p1r2?.yourResult));
  check("A-T2 p2 partial(2/3) not fully correct -> streak reset 0", p2r2?.yourResult?.isCorrect === false && p2r2.yourResult.streak === 0, JSON.stringify(p2r2?.yourResult));
  check("A-T2 p3 no-submit -> 0 pts, streak 0", p3r2?.yourResult?.pointsEarned === 0 && p3r2.yourResult.streak === 0, JSON.stringify(p3r2?.yourResult));
  const p3T2events = p3.all("answerRevealed").filter(r => r.questionId === "t2-q1");
  console.log(`   [obs] non-submitter p3 received ${p3T2events.length} answerRevealed for t2-q1 (>1 => duplicate emit; last has yourResult=${p3T2events[p3T2events.length - 1]?.yourResult !== undefined})`);

  host.emit("nextStation");
  await screen.waitFor("roomState", s => s.phase === "STATION_OPEN" && s.currentStation === 3, 6000);

  // ---- STATION 3 (dragdrop) 8 items ----
  const fullPlacement: Record<string, string> = { i1: "b1", i2: "b1", i3: "b2", i4: "b2", i5: "b3", i6: "b3", i7: "b4", i8: "b4" };
  const halfPlacement: Record<string, string> = { i1: "b1", i2: "b1", i3: "b2", i4: "b2", i5: "b1", i6: "b1", i7: "b1", i8: "b1" }; // 4/8
  await runStation({
    label: "A-T3", station: 3, qId: "t3-q1",
    answers: [
      { c: p1, ans: { type: "dragdrop", placement: fullPlacement } }, // full -> streak 3
      { c: p2, ans: { type: "dragdrop", placement: halfPlacement } }, // 4/8 partial
    ],
    expectCorrect: (c) => c.placement && c.placement.i1 === "b1" && c.placement.i8 === "b4",
    leakCheck: (q) => (q.items || []).every((it: any) => it.correctBucket === undefined) && !!q.buckets,
    advance: "next",
  });
  const p1r3 = p1.resultFor("t3-q1"); const p2r3 = p2.resultFor("t3-q1");
  check("A-T3 COMBO: p1 streak=3, fully correct", p1r3?.yourResult?.streak === 3 && p1r3.yourResult.isCorrect === true, JSON.stringify(p1r3?.yourResult));
  check("A-T3 p2 partial(4/8) earns partial>0 but not fully correct", p2r3?.yourResult?.isCorrect === false && p2r3.yourResult.pointsEarned > 0, JSON.stringify(p2r3?.yourResult));

  host.emit("nextStation");
  await screen.waitFor("roomState", s => s.phase === "STATION_OPEN" && s.currentStation === 4, 6000);

  // ---- STATION 4 (now SELECTWRONG after reorder — "chọn phương án SAI") ----
  const t4qid = playedQid(4);
  const t4full = getQuestionFull(t4qid)!;
  check("A-T4 played question is selectwrong (reorder → đúng thể thức Trạm 4)", t4full?.type === "selectwrong", "type=" + t4full?.type + " id=" + t4qid);
  await runStation({
    label: "A-T4", station: 4, qId: t4qid,
    answers: [
      { c: p1, ans: correctAnswer(t4full) }, // correct -> streak 4
      { c: p2, ans: wrongAnswer(t4full) },   // wrong
    ],
    expectCorrect: (c) => c.wrongOptionId === t4full.correct,
    leakCheck: (q) => q.correct === undefined && (q.options || []).every((o: any) => o.isCorrect === undefined),
    advance: "boss",
  });
  const p1r4 = p1.resultFor(t4qid);
  check("A-T4 COMBO: p1 streak=4 (selectwrong correct)", p1r4?.yourResult?.streak === 4 && p1r4?.yourResult?.isCorrect === true, JSON.stringify(p1r4?.yourResult));

  // ---- BOSS (startBoss from LEADERBOARD) — now a MATCHING question after reorder ----
  const bossQid = playedQid("boss");
  const bossFull = getQuestionFull(bossQid)!;
  host.emit("startBoss");
  const bi = await screen.waitFor("bossPhase", b => b.phase === "BOSS_INTRO", 6000);
  check("A-Boss BOSS_INTRO, multiplier=2, title", bi.pointsMultiplier === 2 && !!bi.title);
  const bso = await screen.waitFor("stationOpened", q => q.question.questionId === bossQid, 6000);
  check("A-Boss played question is matching (reorder → đúng thể thức Boss 'ghép công cụ')", bossFull?.type === "matching", "type=" + bossFull?.type + " id=" + bossQid);
  check("A-Boss question delivered, pointsMultiplier>=2", (bso.question.pointsMultiplier || 1) >= 2, JSON.stringify(bso.question.pointsMultiplier));
  check("A-Boss NO answer leak (items carry no correctBucket)", (bso.question.items || []).every((it: any) => it.correctBucket === undefined), JSON.stringify(bso.question.items?.[0]));

  host.emit("startAnswering", { questionId: bossQid });
  const bansw = await screen.waitFor("bossPhase", b => b.phase === "BOSS_ANSWERING", 6000).catch(() => null);
  check("A-Boss startAnswering emits bossPhase BOSS_ANSWERING", !!bansw);
  await screen.waitFor("timerSync", t => t.questionId === bossQid, 4000);
  await p1.emitAck("submitAnswer", { questionId: bossQid, answer: correctAnswer(bossFull), clientSentAt: Date.now() }); // full correct
  await p2.emitAck("submitAnswer", { questionId: bossQid, answer: correctAnswer(bossFull), clientSentAt: Date.now() });
  await p3.emitAck("submitAnswer", { questionId: bossQid, answer: wrongAnswer(bossFull), clientSentAt: Date.now() });
  host.emit("lockAnswers", { questionId: bossQid });
  await screen.waitFor("roomState", s => s.phase === "LOCKED", 6000);
  host.emit("revealAnswer", { questionId: bossQid });
  const bosRev = await screen.waitFor("answerRevealed", r => r.questionId === bossQid, 6000);
  // FIX #1: after lock, boss reveal must now surface the BOSS_REVEAL climax phase + event.
  const bossRevealPhase = await screen.waitFor("roomState", s => s.phase === "BOSS_REVEAL", 2000).catch(() => null);
  const bossRevealEvt = await screen.waitFor("bossPhase", b => b.phase === "BOSS_REVEAL", 1000).catch(() => null);
  check("A-Boss FIX#1 reveal reaches BOSS_REVEAL phase (climax)", !!bossRevealPhase,
    `observed phase after boss reveal = ${screen.last("roomState")?.phase}`);
  check("A-Boss FIX#1 bossPhase BOSS_REVEAL broadcast", !!bossRevealEvt);
  const p1rb = p1.resultFor(bossQid);
  check("A-Boss p1 correct (matching full), streak=5", p1rb?.yourResult?.isCorrect === true && p1rb.yourResult.streak === 5, JSON.stringify(p1rb?.yourResult));
  check("A-Boss x2 MULTIPLIER applied (pts >= 2.5x base)", p1rb.yourResult.pointsEarned >= bossFull.basePoints * 2.5, `pts=${p1rb?.yourResult?.pointsEarned} base=${bossFull.basePoints}`);

  // leaderboard then end
  host.emit("showLeaderboard");
  const finalLb = await screen.waitFor("leaderboardUpdate", () => true, 6000);
  // An (p1) played perfectly (+ boss x2) so is the clear top scorer -> An's AUTO-ASSIGNED team ranks 1.
  const anTeam = finalLb.teams.find((t: any) => t.teamId === anTeamId);
  check("A-Final An's team is rank 1", anTeam?.rank === 1, JSON.stringify(finalLb.teams));

  host.emit("endGame");
  const ge = await screen.waitFor("gameEnded", () => true, 6000);
  check("A-End gameEnded winnerTeam is An's team", ge.winnerTeam?.teamId === anTeamId, JSON.stringify(ge.winnerTeam));
  check("A-End topPlayers[0] is An (highest score)", ge.topPlayers?.[0]?.nickname === "An", JSON.stringify(ge.topPlayers?.slice(0, 2)));
  await screen.waitFor("roomState", s => s.phase === "VICTORY", 4000);
  const ended = await screen.waitFor("roomState", s => s.phase === "ENDED", 4000);
  check("A-End auto-advances VICTORY -> ENDED", ended.phase === "ENDED");

  [host, screen, p1, p2, p3].forEach(c => c.disconnect());
}

// =====================================================================================
async function partB_validation() {
  console.log("\n=== PART B: VALIDATION & ANTI-CHEAT ===");
  // join non-existent room
  const x = new C(); await x.connect();
  const bad = await x.emitAck("joinRoom", { roomCode: "ZZZZ", role: "player" });
  check("B1 join non-existent room -> ROOM_NOT_FOUND", bad?.ok === false && bad?.error === "ROOM_NOT_FOUND", JSON.stringify(bad));
  x.disconnect();

  const { roomCode, hostToken } = await createRoom();
  // host with wrong token
  const badHost = new C({ auth: { hostToken: "WRONG" } }); await badHost.connect();
  const bh = await badHost.emitAck("joinRoom", { roomCode, role: "host" });
  check("B2 host wrong token -> BAD_HOST_TOKEN", bh?.ok === false && bh?.error === "BAD_HOST_TOKEN", JSON.stringify(bh));
  badHost.disconnect();

  const host = new C({ auth: { hostToken } }); await host.connect();
  await host.emitAck("joinRoom", { roomCode, role: "host" });

  // non-host tries a host action
  const intruder = await joinPlayer(roomCode, "Hacker");
  intruder.emit("openStation", { station: 1 });
  const err = await intruder.waitFor("errorEvent", e => e.code === "NOT_HOST", 3000).catch(() => null);
  check("B3 non-host host-action -> NOT_HOST error", !!err, JSON.stringify(err));

  // (B4 removed: team self-selection was deleted from the product. Players no longer pick a team,
  //  so there is no LOBBY-phase team-pick event left to reject.)

  // A second player (auto-assigned a team on join) — used by the team-gate check (B8) below.
  const other = await joinPlayer(roomCode, "KhongDoi");
  // A teamed mate so auto-lock does NOT fire after a single submit (keeps room ANSWERING for idempotency test)
  const mate = await joinPlayer(roomCode, "DongDoi");

  // start (teams are auto-assigned on join — no self-select step)
  host.emit("startGame", { roomCode });
  await intruder.waitFor("roomState", s => s.phase === "TEAM_SELECT");
  await sleep(150);

  // open station but submit BEFORE startAnswering (phase STATION_OPEN)
  host.emit("openStation", { station: 1 });
  await intruder.waitFor("stationOpened", q => q.question.questionId === "t1-q1");
  const early = await intruder.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  check("B5 submit before ANSWERING -> NOT_ANSWERING", early?.ok === false && early?.error === "NOT_ANSWERING", JSON.stringify(early));

  host.emit("startAnswering", { questionId: "t1-q1" });
  await intruder.waitFor("roomState", s => s.phase === "ANSWERING");

  // stale questionId
  const stale = await intruder.emitAck("submitAnswer", { questionId: "t1-q99", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  check("B6 stale questionId -> STALE_QUESTION", stale?.ok === false && stale?.error === "STALE_QUESTION", JSON.stringify(stale));

  // invalid payload (mcq missing optionId)
  const invalid = await intruder.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq" } as any, clientSentAt: Date.now() });
  check("B7 invalid answer payload -> INVALID_ANSWER", invalid?.ok === false && invalid?.error === "INVALID_ANSWER", JSON.stringify(invalid));

  // B8 (was: submit-without-team -> TEAM_REQUIRED). Team self-selection is gone and the server now
  // AUTO-ASSIGNS every player a valid team on join, so the anti-cheat "must be on a team to submit"
  // gate is now guaranteed structurally — a team-less player can no longer exist. Assert the
  // invariant that REPLACES the old rejection: a joined player has a real team (1..6) and can submit.
  const otherTa = other.last("teamAssigned");
  check("B8 player auto-assigned a valid team on join (team-gate satisfied by construction)",
    !!otherTa && otherTa.teamId >= 1 && otherTa.teamId <= 6 && !!otherTa.teamName, JSON.stringify(otherTa));
  const otherSub = await other.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  check("B8 auto-assigned (teamed) player can submit — no TEAM_REQUIRED", otherSub?.ok === true && otherSub?.received === true, JSON.stringify(otherSub));

  // valid submit, then duplicate (idempotency) — room stays ANSWERING because 'mate' hasn't submitted
  const ok1 = await intruder.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  const ok2 = await intruder.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "B" }, clientSentAt: Date.now() });
  check("B9 first submit ok", ok1?.ok === true && ok1?.received === true);
  check("B9 duplicate submit idempotent (received true, not error)", ok2?.ok === true && ok2?.received === true, JSON.stringify(ok2));

  // reveal and confirm intruder graded ONCE with FIRST answer (A=correct) not overwritten by B
  host.emit("lockAnswers", { questionId: "t1-q1" });
  await intruder.waitFor("roomState", s => s.phase === "LOCKED", 4000);
  host.emit("revealAnswer", { questionId: "t1-q1" });
  const irev = await intruder.waitFor("answerRevealed", r => r.questionId === "t1-q1", 4000);
  check("B9 idempotency: graded with FIRST answer A (correct), not overwritten", irev.yourResult?.isCorrect === true && irev.yourResult.pointsEarned > 0, JSON.stringify(irev.yourResult));

  [host, intruder, other, mate].forEach(c => c.disconnect());
}

// =====================================================================================
async function partC_reconnect() {
  console.log("\n=== PART C: RECONNECT / RESILIENCE ===");
  const { roomCode, hostToken } = await createRoom();
  const host = new C({ auth: { hostToken } }); await host.connect();
  await host.emitAck("joinRoom", { roomCode, role: "host" });
  const p = await joinPlayer(roomCode, "MatMang");
  host.emit("startGame", { roomCode });
  await p.waitFor("roomState", s => s.phase === "TEAM_SELECT");
  await sleep(150); // team auto-assigned on join
  host.emit("openStation", { station: 1 });
  await p.waitFor("stationOpened", q => q.question.questionId === "t1-q1");
  host.emit("startAnswering", { questionId: "t1-q1" });
  await p.waitFor("roomState", s => s.phase === "ANSWERING");
  // score a correct answer
  await p.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  host.emit("lockAnswers", { questionId: "t1-q1" });
  await p.waitFor("roomState", s => s.phase === "LOCKED", 4000);
  host.emit("revealAnswer", { questionId: "t1-q1" });
  const beforeRev = await p.waitFor("answerRevealed", r => r.questionId === "t1-q1", 4000);
  const scoreBefore = beforeRev.yourResult.pointsEarned;
  check("C1 player scored before disconnect", scoreBefore > 0, "score=" + scoreBefore);

  const token = p.reconnectToken!;
  p.disconnect();
  await sleep(300);

  // Reconnect during next station's answering to verify question+timer re-sent
  host.emit("showLeaderboard");
  await host.waitFor("leaderboardUpdate", () => true, 4000).catch(() => null);
  host.emit("nextStation");
  await sleep(200);
  host.emit("startAnswering", { questionId: "t2-q1" });
  await sleep(200);

  const p2 = new C(); await p2.connect();
  const rj = await p2.emitAck("joinRoom", { roomCode, role: "player", reconnectToken: token });
  check("C2 rejoin via reconnectToken ok, same playerId", rj?.ok === true && rj?.playerId === p.playerId, JSON.stringify(rj));
  const so = await p2.waitFor("stationOpened", q => q.question.questionId === "t2-q1", 4000).catch(() => null);
  check("C3 reconnect during ANSWERING re-sends current question", !!so, so ? "" : "no stationOpened");
  const ts = await p2.waitFor("timerSync", t => t.questionId === "t2-q1", 4000).catch(() => null);
  check("C4 reconnect re-sends timerSync", !!ts);

  // score preserved: answer t2 fully correct, then reveal shows cumulative streak/score
  await p2.emitAck("submitAnswer", { questionId: "t2-q1", answer: { type: "truefalse", answers: { s1: false, s2: true, s3: true } }, clientSentAt: Date.now() });
  host.emit("lockAnswers", { questionId: "t2-q1" });
  await p2.waitFor("roomState", s => s.phase === "LOCKED", 4000);
  host.emit("revealAnswer", { questionId: "t2-q1" });
  const afterRev = await p2.waitFor("answerRevealed", r => r.questionId === "t2-q1", 4000);
  check("C5 score PRESERVED across reconnect (streak continues to 2)", afterRev.yourResult.streak === 2, JSON.stringify(afterRev.yourResult));

  [host, p2].forEach(c => c.disconnect());
}

// =====================================================================================
async function partD_hostControls() {
  console.log("\n=== PART D: AUTO-LOCK, PAUSE/RESUME, SET MODE ===");
  const { roomCode, hostToken } = await createRoom();
  const host = new C({ auth: { hostToken } }); await host.connect();
  await host.emitAck("joinRoom", { roomCode, role: "host" });
  const p1 = await joinPlayer(roomCode, "Đội1");
  const p2 = await joinPlayer(roomCode, "Đội2");
  host.emit("startGame", { roomCode });
  await p1.waitFor("roomState", s => s.phase === "TEAM_SELECT");
  await sleep(150); // teams auto-assigned on join (p1, p2 each on their own team)

  // setMode
  host.emit("setMode", { mode: "lite" });
  const mc = await p1.waitFor("modeChanged", m => m.mode === "lite", 3000).catch(() => null);
  check("D1 setMode broadcast modeChanged=lite", !!mc, JSON.stringify(mc));

  host.emit("openStation", { station: 1 });
  await p1.waitFor("stationOpened", q => q.question.questionId === "t1-q1");
  host.emit("startAnswering", { questionId: "t1-q1" });
  await p1.waitFor("roomState", s => s.phase === "ANSWERING");

  // PAUSE
  host.emit("pauseGame");
  await p1.waitFor("roomState", s => s.phase === "PAUSED", 3000);
  check("D2 pauseGame -> PAUSED", true);
  // submit during pause rejected
  const dp = await p1.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  check("D2 submit during PAUSE rejected (NOT_ANSWERING)", dp?.ok === false && dp?.error === "NOT_ANSWERING", JSON.stringify(dp));
  // RESUME
  host.emit("resumeGame");
  await p1.waitFor("roomState", s => s.phase === "ANSWERING", 3000);
  const ts2 = await p1.waitFor("timerSync", t => t.questionId === "t1-q1", 3000).catch(() => null);
  check("D3 resumeGame -> ANSWERING + timerSync re-sent", !!ts2);

  // AUTO-LOCK: both players submit -> room auto-locks without host lock
  p1.clear("roomState"); p2.clear("roomState");
  await p1.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  await p2.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "B" }, clientSentAt: Date.now() });
  const locked = await p1.waitFor("roomState", s => s.phase === "LOCKED", 3000).catch(() => null);
  check("D4 AUTO-LOCK when all players submitted (no host lock)", !!locked, locked ? "" : "did not auto-lock");

  [host, p1, p2].forEach(c => c.disconnect());
}

// =====================================================================================
async function partE_edge() {
  console.log("\n=== PART E: EDGE CASES (nickname collisions, profanity, nextStation-on-boss) ===");
  const { roomCode, hostToken } = await createRoom();
  const host = new C({ auth: { hostToken } }); await host.connect();
  await host.emitAck("joinRoom", { roomCode, role: "host" });

  // duplicate nickname
  const a = await joinPlayer(roomCode, "TrungTen");
  await sleep(100);
  const b = await joinPlayer(roomCode, "TrungTen");
  const pl = await host.waitFor("playerList", p => p.players.length >= 2 && p.players.some((x: any) => x.nickname === "TrungTen (1)"), 4000).catch(() => null);
  check("E1 duplicate nickname auto-suffixed 'TrungTen (1)'", !!pl, pl ? JSON.stringify(pl.players.map((x: any) => x.nickname)) : "no suffix seen");

  // profanity nickname
  const c = await joinPlayer(roomCode, "fuck");
  const perr = await c.waitFor("errorEvent", e => e.code === "INVALID_NICKNAME", 3000).catch(() => null);
  check("E2 profanity nickname -> INVALID_NICKNAME + reset", !!perr, JSON.stringify(perr));

  // nickname too short handled
  const d = await joinPlayer(roomCode, "x");
  const derr = await d.waitFor("errorEvent", e => e.code === "INVALID_NICKNAME", 3000).catch(() => null);
  check("E3 too-short nickname (<2) -> INVALID_NICKNAME + fallback", !!derr, JSON.stringify(derr));

  // nextStation while on boss -> observe behavior (suspected reset-to-1 bug)
  [a, b, c, d].forEach(x => x.disconnect());
  const p = await joinPlayer(roomCode, "SoloBoss");
  host.emit("startGame", { roomCode });
  await p.waitFor("roomState", s => s.phase === "TEAM_SELECT");
  await sleep(120); // team auto-assigned on join
  // Proper path to boss: open t1 -> answer -> lock -> reveal -> leaderboard -> startBoss
  host.emit("openStation", { station: 1 });
  await p.waitFor("stationOpened", q => q.question.questionId === "t1-q1");
  host.emit("startAnswering", { questionId: "t1-q1" });
  await p.waitFor("roomState", s => s.phase === "ANSWERING");
  await p.emitAck("submitAnswer", { questionId: "t1-q1", answer: { type: "mcq", optionId: "A" }, clientSentAt: Date.now() });
  await p.waitFor("roomState", s => s.phase === "LOCKED", 4000);
  host.emit("revealAnswer", { questionId: "t1-q1" });
  await p.waitFor("answerRevealed", () => true, 4000);
  host.emit("showLeaderboard");
  await p.waitFor("leaderboardUpdate", () => true, 4000);
  host.emit("startBoss");
  await p.waitFor("roomState", s => s.phase === "BOSS_INTRO", 4000);
  const eBossQid = playedQid("boss");
  host.emit("startAnswering", { questionId: eBossQid });
  await p.waitFor("roomState", s => s.phase === "BOSS_ANSWERING", 4000);
  await p.emitAck("submitAnswer", { questionId: eBossQid, answer: correctAnswer(getQuestionFull(eBossQid)), clientSentAt: Date.now() });
  await p.waitFor("roomState", s => s.phase === "LOCKED", 4000);
  host.emit("revealAnswer", { questionId: eBossQid });
  // FIX #1 re-check in a single-player auto-lock path: boss reveal reaches BOSS_REVEAL.
  const eBossReveal = await p.waitFor("roomState", s => s.phase === "BOSS_REVEAL", 4000).catch(() => null);
  check("E-pre FIX#1 boss reveal reaches BOSS_REVEAL (auto-lock path)", !!eBossReveal, "phase=" + p.last("roomState")?.phase);
  host.emit("showLeaderboard");
  await p.waitFor("roomState", s => s.phase === "LEADERBOARD", 4000);
  // FIX #2: nextStation while on boss must NOT loop back to Station 1.
  p.clear("roomState");
  host.emit("nextStation");
  const afterBossNext = await p.waitFor("roomState", s => s.phase === "STATION_OPEN", 2500).catch(() => null);
  check("E4 FIX#2 nextStation after boss does NOT reset to Station 1",
    afterBossNext === null || afterBossNext.currentStation !== 1,
    afterBossNext ? `observed phase=${afterBossNext.phase} station=${afterBossNext.currentStation}` : "no transition (correct)");

  [host, p].forEach(x => x.disconnect());
}

// =====================================================================================
async function partF_gradingUnits() {
  console.log("\n=== PART F: GRADING UNITS for UNPLAYED types (selectwrong, matching, partial) ===");
  // selectwrong: correct means selecting the WRONG option (q.correct holds the wrong-option id)
  const sw: any = { type: "selectwrong", correct: "D", options: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }], basePoints: 1000, timeLimitSec: 20 };
  check("F1 selectwrong: choosing q.correct id => isCorrect", gradeAnswer(sw, { type: "selectwrong", optionId: "D" } as any).isCorrect === true);
  check("F1 selectwrong: choosing other id => wrong", gradeAnswer(sw, { type: "selectwrong", optionId: "A" } as any).isCorrect === false);

  // matching full & partial
  const mt: any = { type: "matching", items: [{ id: "i1", correctBucket: "b1" }, { id: "i2", correctBucket: "b2" }, { id: "i3", correctBucket: "b1" }, { id: "i4", correctBucket: "b2" }], basePoints: 1000, timeLimitSec: 20 };
  const gFull = gradeAnswer(mt, { type: "matching", placement: { i1: "b1", i2: "b2", i3: "b1", i4: "b2" } } as any);
  check("F2 matching full correct => ratio 1", gFull.isCorrect === true && gFull.correctRatio === 1);
  const gHalf = gradeAnswer(mt, { type: "matching", placement: { i1: "b1", i2: "b2", i3: "b2", i4: "b1" } } as any);
  check("F2 matching 2/4 => ratio .5, not fully correct", Math.abs(gHalf.correctRatio - 0.5) < 1e-9 && gHalf.isCorrect === false);

  // type mismatch => wrong
  check("F3 answer type mismatch => wrong", gradeAnswer(sw, { type: "mcq", optionId: "D" } as any).isCorrect === false);

  // points: speed monotonic (more remaining => more points) & combo cap 1.5 & boss x2
  const q: any = { basePoints: 1000, timeLimitSec: 20 };
  const gr = { isCorrect: true, correctRatio: 1 };
  const fast = calculatePoints(q, gr, 0, 20000, 20); // full time remaining
  const slow = calculatePoints(q, gr, 0, 2000, 20);  // little remaining
  check("F4 speed bonus monotonic (fast>slow)", fast.pointsEarned > slow.pointsEarned, `fast=${fast.pointsEarned} slow=${slow.pointsEarned}`);
  const combo6 = calculatePoints(q, gr, 6, 0, 20); // streakBefore 6 -> newStreak 7 -> capped 0.5 => x1.5
  check("F5 combo cap x1.5 (streak>=5)", combo6.pointsEarned === Math.round(1000 * 1.5), `pts=${combo6.pointsEarned}`);
  const bossQ: any = { basePoints: 1500, timeLimitSec: 30, pointsMultiplier: 2 };
  const bossPts = calculatePoints(bossQ, gr, 0, 0, 30); // no speed, streak1 -> combo1.1, x2
  check("F6 boss x2 multiplier (1500*1.1*2=3300)", bossPts.pointsEarned === Math.round(1500 * 1.1 * 2), `pts=${bossPts.pointsEarned}`);
  const wrong = calculatePoints(q, { isCorrect: false, correctRatio: 0 }, 3, 20000, 20);
  check("F7 wrong answer => 0 pts, streak reset 0", wrong.pointsEarned === 0 && wrong.newStreak === 0);
}

// =====================================================================================
async function partG_multiQuestion() {
  console.log("\n=== PART G: MULTI-QUESTION PER STATION (bản CHUẨN 1–2 câu/trạm) ===");
  const { roomCode, hostToken } = await createRoom();
  const host = new C({ auth: { hostToken } }); await host.connect();
  await host.emitAck("joinRoom", { roomCode, role: "host" });
  const p = await joinPlayer(roomCode, "ChuanMode");
  host.emit("startGame", { roomCode });
  await p.waitFor("roomState", s => s.phase === "TEAM_SELECT");
  await sleep(150); // team auto-assigned on join

  const q1 = playedQid(1);            // t1-q1
  const q2 = getStationQuestionList(1)[1]; // t1-q2 (the 2nd question of station 1)

  // First question of station 1
  host.emit("openStation", { station: 1 });
  await p.waitFor("stationOpened", so => so.question.questionId === q1, 4000);
  const rs1 = await p.waitFor("roomState", s => s.currentQuestionId === q1, 4000);
  check("G1 station 1 opened first question", rs1.currentStation === 1);
  host.emit("startAnswering", { questionId: q1 });
  await p.waitFor("roomState", s => s.phase === "ANSWERING", 4000);
  await p.emitAck("submitAnswer", { questionId: q1, answer: correctAnswer(getQuestionFull(q1)), clientSentAt: Date.now() });
  await p.waitFor("roomState", s => s.phase === "LOCKED", 4000);
  host.emit("revealAnswer", { questionId: q1 });
  const revState = await p.waitFor("roomState", s => s.phase === "REVEAL", 4000);
  check("G2 hasMoreInStation=true at REVEAL (station 1 has >1 question)", revState.hasMoreInStation === true, JSON.stringify({ hasMore: revState.hasMoreInStation }));

  // Host adds another question in the SAME station (multi-question flow)
  p.clear("stationOpened");
  host.emit("openStation", { station: 1 });
  const so2 = await p.waitFor("stationOpened", so => so.question.questionId === q2, 4000).catch(() => null);
  check("G3 re-opening same station ADVANCES to next question (t1-q2, not reset to q1)", !!so2 && so2.question.questionId === q2,
    so2 ? `advanced to ${so2.question.questionId}` : `no advance (still ${p.last("stationOpened")?.question?.questionId})`);
  const rs2 = await p.waitFor("roomState", s => s.currentQuestionId === q2, 3000).catch(() => null);
  check("G4 roomState currentQuestionId advanced to q2", !!rs2 && rs2.currentQuestionId === q2, JSON.stringify(rs2?.currentQuestionId));

  // The advanced question is answerable and scores normally
  host.emit("startAnswering", { questionId: q2 });
  await p.waitFor("roomState", s => s.phase === "ANSWERING", 4000);
  const ack = await p.emitAck("submitAnswer", { questionId: q2, answer: correctAnswer(getQuestionFull(q2)), clientSentAt: Date.now() });
  check("G5 advanced question is answerable (submit ok)", ack?.ok === true && ack?.received === true, JSON.stringify(ack));

  [host, p].forEach(x => x.disconnect());
}

// =====================================================================================
async function partH_hostAnswerPreview() {
  console.log("\n=== PART H: HOST-ONLY ANSWER PREVIEW (NFR4 — đáp án KHÔNG rời server) ===");
  const { roomCode, hostToken } = await createRoom();
  const host = new C({ auth: { hostToken } }); await host.connect();
  await host.emitAck("joinRoom", { roomCode, role: "host" });
  const screen = new C(); await screen.connect();
  await screen.emitAck("joinRoom", { roomCode, role: "screen" });
  const p = await joinPlayer(roomCode, "SinhVien");
  host.emit("startGame", { roomCode });
  await p.waitFor("roomState", s => s.phase === "TEAM_SELECT");
  await sleep(150); // team auto-assigned on join

  const q1 = playedQid(1);
  const q1full = getQuestionFull(q1)!;
  host.emit("openStation", { station: 1 });
  const hqi = await host.waitFor("hostQuestionInfo", h => h.questionId === q1, 4000).catch(() => null);
  check("H1 host receives hostQuestionInfo on openStation", !!hqi, JSON.stringify(hqi && { qid: hqi.questionId, hasAnswer: !!hqi.answerText }));
  check("H2 answerText reveals the correct key to MC", !!hqi && hqi.answerText.includes("Đáp án đúng: " + q1full.correct), `answerText="${hqi?.answerText?.slice(0, 60)}"`);
  check("H3 hostQuestionInfo carries explain", !!hqi && typeof hqi.explain === "string" && hqi.explain.length > 0);

  // ANTI-LEAK: player and screen must NEVER receive hostQuestionInfo
  await sleep(300);
  check("H4 PLAYER did NOT receive hostQuestionInfo (anti-leak NFR4)", p.count("hostQuestionInfo") === 0, "player got " + p.count("hostQuestionInfo"));
  check("H5 SCREEN did NOT receive hostQuestionInfo (anti-leak NFR4)", screen.count("hostQuestionInfo") === 0, "screen got " + screen.count("hostQuestionInfo"));
  // ANTI-LEAK: player's stationOpened question still carries no answer key
  const so = p.last("stationOpened");
  check("H6 player stationOpened has NO answer key", !!so && so.question.correct === undefined && (so.question.options || []).every((o: any) => o.isCorrect === undefined),
    JSON.stringify(so?.question && Object.keys(so.question)));

  // Host re-join mid-question re-receives the preview
  const host2 = new C({ auth: { hostToken } }); await host2.connect();
  await host2.emitAck("joinRoom", { roomCode, role: "host" });
  const hqi2 = await host2.waitFor("hostQuestionInfo", h => h.questionId === q1, 4000).catch(() => null);
  check("H7 re-joining host re-receives current answer preview", !!hqi2 && !!hqi2.answerText, JSON.stringify(!!hqi2));

  [host, host2, screen, p].forEach(c => c.disconnect());
}

// =====================================================================================
(async () => {
  console.log("#####################################################");
  console.log("#  QC E2E SUITE — Hành Trình Định Hướng             #");
  console.log("#####################################################");
  const parts: [string, () => Promise<void>][] = [
    ["A full game", partA_fullGame],
    ["B validation", partB_validation],
    ["C reconnect", partC_reconnect],
    ["D host controls", partD_hostControls],
    ["E edge cases", partE_edge],
    ["F grading units", partF_gradingUnits],
    ["G multi-question", partG_multiQuestion],
    ["H host answer preview", partH_hostAnswerPreview],
  ];
  for (const [name, fn] of parts) {
    try { await fn(); }
    catch (e: any) { FAIL++; failures.push(`PART ${name} THREW: ${e.message}`); console.log(`   ✗✗ PART ${name} THREW:`, e.message); }
  }
  console.log("\n#####################################################");
  console.log(`#  RESULT:  PASS=${PASS}   FAIL=${FAIL}`);
  console.log("#####################################################");
  if (failures.length) {
    console.log("\nFAILURES:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  process.exit(FAIL === 0 ? 0 : 1);
})();
