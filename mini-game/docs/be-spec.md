# BE SPECIFICATION — "Hành Trình Định Hướng: Vượt 5 Trạm Tri Thức"

> **Tài liệu hướng dẫn Lập trình viên Backend.**
> Máy chủ realtime cho mini game ôn tập KTCT Mác - Lênin, Chương 5. Stack: Node.js + Socket.io v4 (Express) + TypeScript, state in-memory, chấm điểm server-side.
> **Phiên bản:** 1.0 · **Ngày:** 2026-07-09
>
> **Ràng buộc:** BE spec này implement ĐÚNG hợp đồng Socket.io / state machine / data model đã chốt trong FE spec.
> Đọc kèm: [`fe-spec.md` — Phần A (Nền tảng)](fe-spec.md) · dữ liệu [`../server/data/questions.json`](../server/data/questions.json) · kế hoạch [`../../Document/ke-hoach-mini-game.md`](../../Document/ke-hoach-mini-game.md).

## 4 nguyên tắc bất di bất dịch (nhắc lại từ hợp đồng)
1. **Server-authoritative** — server giữ `roomState.phase`, client render thuần; client KHÔNG tự chấm điểm/chuyển phase.
2. **Không rò rỉ đáp án** — payload gửi player (`stationOpened`) đã lược `correct`/`isTrue`/`correctBucket`; đáp án chỉ đến qua `answerRevealed`, giải thích qua `knowledgeCard` (sau reveal).
3. **Timer tuyệt đối** — đồng bộ bằng `deadlineTs` (epoch ms từ server); server tự động khóa khi hết giờ.
4. **`submitAnswer` idempotent theo `questionId`** — reconnect gửi lại không cộng điểm 2 lần.

> ⚠️ **Lưu ý khớp dữ liệu:** `questions.json` dùng `station: 6` cho Boss, nhưng hợp đồng `StationId` dùng `"boss"`. BE phải **map `6 ↔ "boss"`** khi nạp câu hỏi và dựng `PublicQuestion`.

---

## A. Kiến trúc & Mô hình dữ liệu

### A.1. Tổng quan kiến trúc

#### A.1.1. Nguyên tắc nền tảng

Backend là một **Node.js + Socket.io v4 (chạy trên Express)** viết bằng **TypeScript**, triển khai theo mô hình **single instance – state in-memory** (không dùng DB cho MVP). Toàn bộ hệ thống tuân thủ 4 nguyên tắc bất di bất dịch từ hợp đồng FE:

1. **Server-authoritative (server là nguồn sự thật duy nhất):** `roomState.phase` do server giữ, client chỉ render thuần theo state nhận được. Client **không tự chấm điểm**, không tự chuyển phase.
2. **Không rò rỉ đáp án:** payload gửi cho `player` (qua `stationOpened`) đã **lược sạch đáp án** (`correct`/`isTrue`/`correctBucket`). Đáp án chỉ đến qua `answerRevealed`; `explain`/`knowledgeCard` chỉ đến qua `knowledgeCard` (sau reveal).
3. **Timer đồng bộ tuyệt đối:** đồng bộ bằng `deadlineTs` (epoch ms tuyệt đối do server phát), server **tự động khóa** khi hết giờ.
4. **submitAnswer idempotent theo `questionId`:** gửi lại (do reconnect) không cộng điểm 2 lần; lấy lần hợp lệ đầu tiên trước deadline.

Quy mô mục tiêu: **~30 người chơi/phòng**. Vì 1 instance + in-memory, mọi truy cập state đều đồng bộ trong 1 process (Node single-threaded event loop → không có race condition ở tầng dữ liệu, chỉ cần cẩn thận với timer bất đồng bộ).

#### A.1.2. Ba loại client (Role)

Theo hợp đồng: `type Role = "player" | "screen" | "host"`.

| Role | Vai trò | Đặc quyền |
|------|---------|-----------|
| `player` | Điện thoại người chơi | join, đặt nickname, chọn team, submit đáp án, gửi reaction. **Nhận payload đã lược đáp án.** |
| `screen` | Màn chiếu (projector) | Chỉ hiển thị; render trạng thái tổng, leaderboard, timer, phân bố % câu trả lời. |
| `host` | Máy điều khiển của MC | Kích hoạt transition (server kiểm `hostToken` trước mọi lệnh host). |

#### A.1.3. Luồng tổng thể (server-authoritative loop)

Phần lớn transition **do HOST kích hoạt**. Ngoại lệ: `LOCKED` có thể do **SERVER** tự động (hết giờ – deadline) hoặc host gọi `lockAnswers`. `PAUSED`/`FALLBACK` là **overlay/mode**, khi thoát quay lại `resumePhase` (server nhớ).

Vòng lặp mỗi trạm (Trạm 1 → 4) và nhánh Boss:

```
                 startGame            (host)
   LOBBY ─────────────────────► TEAM_SELECT ──► INTRO
                                                   │ openStation
                                                   ▼
   ┌─────────────────────────────────────────────────────────┐
   │  MỖI TRẠM (station 1..4)                                 │
   │                                                          │
   │  STATION_OPEN ──startAnswering──► ANSWERING              │
   │                                      │                   │
   │              ┌── SERVER: deadline ───┤                   │
   │              └── HOST: lockAnswers ──┤                   │
   │                                      ▼                   │
   │                                    LOCKED                │
   │                                      │ revealAnswer      │
   │                                      ▼                   │
   │                                   REVEAL                 │
   │                                      │ showKnowledgeCard │
   │                                      ▼                   │
   │                              KNOWLEDGE_CARD              │
   │                                      │ showLeaderboard   │
   │                                      ▼                   │
   │                               LEADERBOARD               │
   └───────────────┬──────────────────────┬──────────────────┘
        nextStation │                      │ startBoss (hết 4 trạm)
      (còn trạm)    │                      ▼
                    │              BOSS_INTRO
     quay lại       │                      │ startAnswering
     STATION_OPEN ◄─┘                      ▼
                                   BOSS_ANSWERING
                                           │ (deadline / lockAnswers)
                                           │ revealAnswer
                                           ▼
                                    BOSS_REVEAL
                                           │ showLeaderboard
                                           ▼
                                    LEADERBOARD
                                           │
                                           ▼
                                       VICTORY ──endGame──► ENDED
```

Hai state cắt ngang (có thể bật/tắt tại gần như mọi phase):

```
   <bất kỳ phase>  ──pauseGame──►  PAUSED  ──resumeGame──►  resumePhase
   <bất kỳ phase>  ──setMode(fallback)──►  FALLBACK  ──setMode──►  resumePhase
```

#### A.1.4. Phase vs Mode (2 trục độc lập)

Hợp đồng phân biệt rõ **phase** (state machine) và **mode** (cross-cutting):

- **`GamePhase`** — 16 state: `LOBBY, TEAM_SELECT, INTRO, STATION_OPEN, ANSWERING, LOCKED, REVEAL, KNOWLEDGE_CARD, LEADERBOARD, BOSS_INTRO, BOSS_ANSWERING, BOSS_REVEAL, VICTORY, ENDED, PAUSED, FALLBACK`.
- **`GameMode`** — 4 giá trị cắt ngang, **không phải phase**: `"lite" | "chuan" | "fallback" | "no-projector"`.

`PAUSED`/`FALLBACK` xuất hiện vừa như phase (giá trị `phase` phát ra trong `roomState`) vừa gắn với `resumePhase`. Khi vào pause/fallback, server lưu phase hiện tại vào `Room.resumePhase`; khi thoát, phát lại `roomState` với `phase = resumePhase`.

#### A.1.5. Sơ đồ khối hệ thống

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  player x30  │   │   screen     │   │    host      │
│ (điện thoại) │   │ (màn chiếu)  │   │  (MC panel)  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │  WebSocket (Socket.io v4)           │
       └──────────────┬──────────────────────┘
                      ▼
      ┌───────────────────────────────────────┐
      │   Express HTTP server (1 instance)     │
      │  ┌─────────────────────────────────┐   │
      │  │  Socket.io Gateway (src/socket) │   │  ◄── xác thực role,
      │  │  - đăng ký event handler        │   │      kiểm hostToken,
      │  │  - vào/ra Socket.io room        │   │      validate payload
      │  └───────────────┬─────────────────┘   │
      │                  ▼                      │
      │  ┌─────────────────────────────────┐   │
      │  │  Game Engine (src/game)         │   │  ◄── state machine,
      │  │  - transition hợp lệ            │   │      guard chuyển phase,
      │  │  - điều phối timer & broadcast  │   │      resumePhase
      │  └───┬────────────┬────────────┬───┘   │
      │      ▼            ▼            ▼        │
      │  ┌────────┐  ┌─────────┐  ┌──────────┐ │
      │  │scoring │  │questions│  │ rooms    │ │
      │  │(chấm   │  │(nạp     │  │(RoomStore│ │
      │  │ điểm   │  │ đáp án  │  │ in-memory│ │
      │  │ server)│  │ đầy đủ) │  │ Map)     │ │
      │  └────────┘  └─────────┘  └──────────┘ │
      │  ┌─────────────────────────────────┐   │
      │  │  security (token, CORS, rate)   │   │
      │  └─────────────────────────────────┘   │
      └───────────────────────────────────────┘
                      │
                      ▼
        data/questions.json (40 câu, CÓ đáp án)
```

Ranh giới bảo mật quan trọng: **`data/questions.json` (bản đầy đủ có đáp án) chỉ tồn tại trong process server.** Mọi payload ra ngoài đi qua tầng "public projection" (chuyển `QuestionFull` → `PublicQuestion`) để đảm bảo nguyên tắc #1.

---

### A.2. Cấu trúc thư mục `server/`

```
server/
├── src/
│   ├── index.ts               # Bootstrap: đọc ENV, dựng Express + Socket.io, listen(PORT)
│   │
│   ├── http/                  # Tầng HTTP thuần (ngoài WebSocket)
│   │   ├── app.ts             #   Khởi tạo Express app, gắn CORS, middleware
│   │   └── routes.ts          #   /healthz, /readyz; (tuỳ chọn) tạo phòng & phát hostToken
│   │
│   ├── socket/                # Tầng Socket.io Gateway
│   │   ├── gateway.ts         #   io.on("connection"): định tuyến theo role
│   │   ├── handlers.player.ts #   joinRoom, setNickname, chooseTeam, submitAnswer, sendReaction, rejoin
│   │   ├── handlers.host.ts   #   startGame, openStation, startAnswering, lockAnswers, revealAnswer,
│   │   │                      #     showKnowledgeCard, showLeaderboard, nextStation, startBoss,
│   │   │                      #     pauseGame, resumeGame, setMode, endGame
│   │   ├── emit.ts            #   Hàm phát chuẩn hoá SERVER->CLIENT (roomState, timerSync, ...)
│   │   └── validate.ts        #   Kiểm cấu trúc payload đầu vào trước khi vào engine
│   │
│   ├── game/                  # Game Engine — trái tim state machine
│   │   ├── engine.ts          #   applyTransition(room, action): guard + đổi phase + side-effect
│   │   ├── stateMachine.ts    #   Bảng transition hợp lệ (phase x action -> phase)
│   │   ├── stationFlow.ts     #   Vòng lặp trạm 1..4 + nhánh boss, map station <-> currentQuestion
│   │   └── timer.ts           #   Đặt/huỷ deadline, tự động chuyển ANSWERING -> LOCKED khi hết giờ
│   │
│   ├── scoring/               # Chấm điểm SERVER-SIDE (nguyên tắc #4)
│   │   ├── grade.ts           #   Chấm đúng/sai + chấm từng phần (truefalse/dragdrop/matching)
│   │   ├── points.ts          #   basePoints * đúng + thưởng tốc độ + nhân combo/streak + boss x2
│   │   └── leaderboard.ts     #   Tổng hợp bảng xếp hạng người & team, shipPositions
│   │
│   ├── questions/             # Nạp & chiếu câu hỏi
│   │   ├── loader.ts          #   Đọc data/questions.json, validate schema, index theo questionId
│   │   ├── mapper.ts          #   station 6 <-> "boss"; QuestionFull -> PublicQuestion (lược đáp án)
│   │   └── repo.ts            #   Truy vấn câu theo station/questionId (bản CÓ đáp án)
│   │
│   ├── rooms/                 # Vòng đời & lưu trữ phòng
│   │   ├── store.ts           #   RoomStore = Map<roomCode, Room>; CRUD phòng, tìm theo token
│   │   ├── factory.ts         #   Tạo Room mới: sinh roomCode, hostToken, khởi tạo Team 1..6
│   │   └── janitor.ts         #   Dọn rác theo TTL, đóng phòng khi ENDED
│   │
│   ├── security/              # Bảo mật
│   │   ├── tokens.ts          #   Ký/verify hostToken & reconnectToken (HMAC HOST_TOKEN_SECRET)
│   │   ├── cors.ts            #   Cấu hình CORS_ORIGIN cho cả HTTP & Socket.io
│   │   └── rateLimit.ts       #   Giới hạn tần suất submitAnswer/sendReaction chống spam
│   │
│   ├── shared/
│   │   └── socket/
│   │       └── events.ts      #   KIỂU DÙNG CHUNG với FE (Role, TeamId, GamePhase, PublicQuestion,
│   │                          #     AnswerPayload, mọi event C->S và S->C) — DÙNG NGUYÊN, không đổi tên
│   │
│   ├── types/                 # Kiểu nội bộ server (có đáp án, không share ra client)
│   │   ├── domain.ts          #   Room, Player, Team, Submission, RoomStore
│   │   └── question.ts        #   QuestionFull (bản đầy đủ có đáp án)
│   │
│   └── config/
│       └── env.ts             #   Đọc & validate biến môi trường, xuất object config typed
│
├── data/
│   └── questions.json         # 40 câu CÓ đáp án (Trạm1=7, Trạm2=6, Trạm3=9, Trạm4=7, Boss=11)
│
├── package.json
├── tsconfig.json
└── .env.example
```

Vai trò từng phần (tóm tắt):

- **`http/`** — vỏ HTTP: health-check cho hạ tầng và (tuỳ chọn) endpoint tạo phòng phát `hostToken` cho MC.
- **`socket/`** — biên giới giao tiếp: nhận event, **validate payload**, kiểm `hostToken` cho lệnh host, rồi gọi Game Engine. Không chứa logic nghiệp vụ.
- **`game/`** — state machine: quyết định transition có hợp lệ không, đổi `phase`, đặt/huỷ timer, nhớ `resumePhase`.
- **`scoring/`** — chấm điểm 100% server-side, đảm bảo client không bao giờ tự chấm.
- **`questions/`** — nơi duy nhất chạm bản câu hỏi có đáp án; chịu trách nhiệm **map station 6 ↔ "boss"** và **lược đáp án** khi chiếu ra client.
- **`rooms/`** — lưu trữ in-memory và vòng đời phòng.
- **`security/`** — token, CORS, rate limit.
- **`shared/socket/events.ts`** — hợp đồng kiểu chia sẻ với FE, **giữ nguyên tên**.
- **`types/`** — kiểu nội bộ (có đáp án) **không** rò ra client.

---

### A.3. Mô hình dữ liệu IN-MEMORY (TypeScript, SERVER-SIDE có đáp án)

Đây là các interface nội bộ server (`src/types/`). Chúng **khác** với kiểu public trong `shared/socket/events.ts`: bản nội bộ chứa đáp án và metadata chấm điểm, tuyệt đối không serialize thẳng ra client.

#### A.3.1. Kiểu nền tảng (đồng bộ với hợp đồng)

```typescript
// Nhắc lại kiểu từ hợp đồng shared/socket/events.ts (DÙNG NGUYÊN, không đổi tên)
type Role         = "player" | "screen" | "host";
type TeamId       = 1 | 2 | 3 | 4 | 5 | 6;
type StationId    = 1 | 2 | 3 | 4 | "boss";        // questions.json dùng 6 cho boss -> map ở mapper.ts
type QuestionType = "mcq" | "selectwrong" | "truefalse" | "dragdrop" | "matching";
type GamePhase =
  | "LOBBY" | "TEAM_SELECT" | "INTRO"
  | "STATION_OPEN" | "ANSWERING" | "LOCKED" | "REVEAL" | "KNOWLEDGE_CARD" | "LEADERBOARD"
  | "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL"
  | "VICTORY" | "ENDED" | "PAUSED" | "FALLBACK";
type GameMode     = "lite" | "chuan" | "fallback" | "no-projector";
```

#### A.3.2. `Room` — đối tượng phòng (state gốc)

```typescript
interface Room {
  roomCode: string;              // Mã phòng (client dùng để joinRoom)
  hostToken: string;             // HMAC bí mật — chỉ host giữ; server kiểm mọi lệnh host
  phase: GamePhase;              // NGUỒN SỰ THẬT DUY NHẤT về trạng thái game
  mode: GameMode;                // Trục cắt ngang: lite | chuan | fallback | no-projector
  currentStation: StationId | null;    // Trạm đang chơi (1..4 | "boss"), null ở LOBBY/TEAM_SELECT
  currentQuestionId: string | null;    // Câu đang mở, null khi chưa openStation
  deadlineTs: number | null;     // Epoch ms tuyệt đối khi hết giờ; null khi không đếm giờ
  resumePhase: GamePhase | null; // Phase để quay lại sau khi thoát PAUSED/FALLBACK

  players: Map<string, Player>;  // playerId -> Player
  teams: Map<TeamId, Team>;      // 6 team cố định, khởi tạo lúc tạo phòng

  createdAt: number;             // Epoch ms tạo phòng (dùng cho TTL/janitor)
  lastActivityAt: number;        // Epoch ms hoạt động gần nhất (dùng cho dọn rác idle)

  // Bộ đếm nội bộ hỗ trợ chấm/hiển thị
  timerHandle?: NodeJS.Timeout;  // Handle setTimeout của deadline hiện tại (để huỷ khi lock sớm)
}
```

Ghi chú thiết kế:
- `phase` + `mode` + `currentStation` + `currentQuestionId` + `deadlineTs` + `resumePhase` chính là bộ trường được phóng ra sự kiện **`roomState`** (`{roomCode, phase, mode, currentStation, currentQuestionId, serverNow, resumePhase?}`) — với `serverNow = Date.now()` gắn ngay lúc phát.
- `timerHandle` **không** serialize ra ngoài; chỉ dùng nội bộ để huỷ deadline khi host `lockAnswers` sớm.

#### A.3.3. `Player` — người chơi

```typescript
interface Player {
  playerId: string;              // ID ổn định, cấp lúc joinRoom (trả về trong ack)
  socketId: string | null;       // Socket.io id hiện tại; null khi đang mất kết nối
  nickname: string;
  avatar?: string;
  teamId: TeamId | null;         // null cho tới khi chooseTeam
  reconnectToken: string;        // Token để rejoin sau khi rớt mạng (idempotent submit)

  score: number;                 // Tổng điểm tích luỹ (server chấm)
  streak: number;                // Chuỗi đúng liên tiếp hiện tại (combo)

  connected: boolean;            // Trạng thái kết nối (phóng ra playerList.counts.connected)

  // Idempotency theo questionId (nguyên tắc #3): mỗi câu chỉ tính 1 submission hợp lệ
  submissionsByQuestion: Map<string, Submission>;  // questionId -> Submission

  joinedAt: number;
}
```

Ghi chú:
- Khi phóng **`playerList`**, mỗi phần tử chỉ lấy `{playerId, nickname, avatar?, teamId, connected}` — **không** kèm `score`, `reconnectToken`, `submissionsByQuestion`. `counts` = `{total, connected, perTeam}` tính từ `players`.
- **`reconnectToken`** cấp ở `joinRoom` ack và dùng cho `rejoin({reconnectToken})`. Nhờ `submissionsByQuestion` là Map theo `questionId`, reconnect + gửi lại **không cộng điểm 2 lần**.

#### A.3.4. `Team` — đội (6 đội cố định)

```typescript
interface Team {
  teamId: TeamId;                // 1..6
  teamName: string;              // Tên hiển thị (phóng ra teamAssigned/leaderboardUpdate)
  color: string;                 // Màu nhận diện đội (hex) cho UI/tàu
  score: number;                 // Tổng điểm đội = cộng dồn điểm thành viên
  shipProgress: number;          // 0..1 — tiến độ tàu (phóng ra leaderboardUpdate.shipPositions)
  stationReached: StationId;     // Trạm đội đã tới (cho shipPositions.stationReached)
}
```

Ghi chú: `leaderboardUpdate.teams` lấy `{teamId, teamName, score, rank}` (rank tính lúc phát); `shipPositions` lấy `{teamId, progress, stationReached}` với `progress = shipProgress`.

#### A.3.5. `QuestionFull` — câu hỏi bản đầy đủ CÓ đáp án (server-only)

```typescript
// src/types/question.ts — KHÔNG BAO GIỜ serialize thẳng ra client
interface QuestionFull {
  questionId: string;
  station: 1 | 2 | 3 | 4 | 6;    // questions.json: 6 = boss (map sang "boss" khi ra client)
  stationName: string;
  type: QuestionType;
  topic: string;
  learningLevel: "nho" | "hieu" | "phan_loai" | "van_dung";
  difficulty: 1 | 2 | 3;
  timeLimitSec: number;
  basePoints: number;
  prompt: string;
  pointsMultiplier?: number;     // Boss = 2

  // Dữ liệu hiển thị (sẽ chiếu ra PublicQuestion)
  options?:   { id: string; text: string }[];        // mcq / selectwrong
  statements?:{ id: string; text: string; isTrue: boolean }[];   // truefalse (CÓ isTrue)
  buckets?:   { id: string; name: string }[];         // dragdrop / matching
  items?:     { id: string; text: string; correctBucket: string }[]; // (CÓ correctBucket)

  // ĐÁP ÁN & nội dung sau reveal (server-only)
  correct?: string;              // mcq: id đúng; selectwrong: id phương án SAI
  explain: string;               // Giải thích — chỉ ra qua knowledgeCard
  knowledgeCard: { title: string; body: string; badge?: string; station: StationId };
  commonMistake?: string;
}
```

Quy tắc chiếu (mapper.ts) đảm bảo **nguyên tắc #1** — hàm `toPublicQuestion(q: QuestionFull): PublicQuestion` lược sạch:
- Bỏ `correct`, `explain`, `knowledgeCard`, `commonMistake`.
- `statements` → chỉ còn `{id, text}` (bỏ `isTrue`).
- `items` → chỉ còn `{id, text}` (bỏ `correctBucket`).
- **Map `station: 6 → "boss"`** (và ngược lại khi tra cứu).

Kết quả khớp đúng `PublicQuestion` trong hợp đồng: `{questionId, station, stationName, type, topic, learningLevel, difficulty, timeLimitSec, basePoints, prompt, pointsMultiplier?, options?, statements?, buckets?, items?}`.

#### A.3.6. `Submission` — một lượt trả lời đã chấm (server-only)

```typescript
interface Submission {
  playerId: string;
  questionId: string;
  answer: AnswerPayload;         // Kiểu union theo hợp đồng (mcq/selectwrong/truefalse/dragdrop/matching)

  isCorrect: boolean;            // Đúng hoàn toàn?
  correctRatio: number;          // 0..1 — tỉ lệ đúng từng phần (truefalse/dragdrop/matching)
  responseMs: number;            // deadlineTs - serverReceivedAt tương ứng phần thời gian còn lại
  pointsEarned: number;          // Điểm được cộng (đã gồm thưởng tốc độ + combo, boss x2)

  serverReceivedAt: number;      // Epoch ms server nhận (mốc idempotency & thưởng tốc độ)
  clientSentAt: number;          // Từ payload submitAnswer (chỉ để đo/log, KHÔNG dùng chấm)
}
```

Ghi chú chấm điểm (chi tiết ở Phần chấm điểm):
- **Idempotent:** nếu `submissionsByQuestion.has(questionId)` đã có submission hợp lệ **trước deadline** thì bỏ qua lần sau (không cộng lại). Chỉ lấy **lần hợp lệ đầu tiên trước `deadlineTs`**.
- **Không tin client:** `responseMs`/thưởng tốc độ tính bằng `serverReceivedAt` so với `deadlineTs`, **không** dùng `clientSentAt`.
- `answerAck` phát lại `{questionId, received, serverReceivedAt}`; `submitAnswer` ack trả `{ok, received, error?}`.

#### A.3.7. `RoomStore` — kho phòng in-memory

```typescript
class RoomStore {
  private rooms = new Map<string, Room>();     // roomCode -> Room

  create(room: Room): void;
  get(roomCode: string): Room | undefined;
  delete(roomCode: string): void;
  all(): IterableIterator<Room>;               // cho janitor duyệt TTL

  // Tra cứu phụ trợ
  findByHostToken(token: string): Room | undefined;
  findPlayerByReconnectToken(token: string): { room: Room; player: Player } | undefined;
}
export const roomStore = new RoomStore();      // singleton toàn process (1 instance)
```

Vì chỉ **1 instance**, `roomStore` là singleton duy nhất giữ toàn bộ state. Không có tầng persistence — restart process = mất state (chấp nhận được cho MVP).

---

### A.4. Vòng đời Room & dọn rác (janitor)

#### A.4.1. Các mốc vòng đời

```
create() ──► Room{phase:"LOBBY", createdAt, lastActivityAt}
     │
     │  (chơi qua các phase...)  mỗi event hợp lệ -> lastActivityAt = Date.now()
     ▼
endGame (host) ──► phase="ENDED"
     │
     │  đánh dấu closedAt = Date.now()
     ▼
janitor quét định kỳ ──► xoá khỏi RoomStore
```

Ba lý do một Room bị dọn:

1. **ENDED grace period:** khi `phase = "ENDED"`, phòng còn giữ thêm `ROOM_ENDED_GRACE_MS` (mặc định ~5 phút) để client kịp nhận `gameEnded`, xem leaderboard cuối, rồi mới xoá.
2. **Idle TTL:** phòng không có hoạt động (`now - lastActivityAt > ROOM_IDLE_TTL_MS`, mặc định ~2 giờ) → coi như bỏ hoang, xoá kể cả chưa ENDED (tránh rò rỉ bộ nhớ do MC quên đóng).
3. **Empty room:** phòng không còn player nào `connected` quá `ROOM_EMPTY_TTL_MS` (mặc định ~15 phút) → xoá.

#### A.4.2. Janitor (dọn rác định kỳ)

```typescript
// src/rooms/janitor.ts
function startJanitor(store: RoomStore) {
  setInterval(() => {
    const now = Date.now();
    for (const room of store.all()) {
      const idle    = now - room.lastActivityAt;
      const ended   = room.phase === "ENDED" && (now - room.closedAt!) > ROOM_ENDED_GRACE_MS;
      const isEmpty = countConnected(room) === 0 && idle > ROOM_EMPTY_TTL_MS;
      const expired = idle > ROOM_IDLE_TTL_MS;

      if (ended || isEmpty || expired) {
        clearRoomTimers(room);           // huỷ deadline timer đang chạy (tránh callback mồ côi)
        store.delete(room.roomCode);
      }
    }
  }, JANITOR_INTERVAL_MS);               // quét mỗi ~60s
}
```

Yêu cầu quan trọng: trước khi `store.delete`, **phải huỷ `room.timerHandle`** (deadline `setTimeout`) để không có callback timer chạy trên phòng đã xoá.

#### A.4.3. Tương tác với reconnect

Player mất kết nối (`connected = false`) **không** xoá `Player` ngay — vẫn giữ `reconnectToken` + `submissionsByQuestion` để `rejoin` khôi phục idempotency. Player chỉ bị dọn cùng lúc với Room (theo các quy tắc trên), đảm bảo người rớt mạng tạm thời không mất điểm/streak.

---

### A.5. Cấu hình & ENV

Toàn bộ ENV được đọc và validate một lần ở `src/config/env.ts`, xuất ra object `config` đã có kiểu; code nghiệp vụ **không** đọc `process.env` trực tiếp.

#### A.5.1. Bảng biến môi trường

| Biến | Kiểu | Mặc định | Vai trò |
|------|------|----------|---------|
| `PORT` | number | `3000` | Cổng HTTP/WebSocket của instance. |
| `HOST_TOKEN_SECRET` | string | *(bắt buộc)* | Khoá HMAC ký/verify `hostToken` & `reconnectToken`. **Không có mặc định** — thiếu thì server dừng khởi động. |
| `CORS_ORIGIN` | string (CSV) | `http://localhost:5173` | Danh sách origin được phép (HTTP + Socket.io). |
| `QUESTIONS_PATH` | string | `./data/questions.json` | Đường dẫn file câu hỏi (bản có đáp án). |
| `MAX_PLAYERS` | number | `30` | Giới hạn player/phòng (khớp ~30/phòng). |
| `DEFAULT_MODE` | GameMode | `chuan` | Mode khởi tạo phòng: `lite`\|`chuan`\|`fallback`\|`no-projector`. |
| `ROOM_IDLE_TTL_MS` | number | `7200000` (2h) | Idle TTL trước khi janitor xoá phòng. |
| `ROOM_ENDED_GRACE_MS` | number | `300000` (5m) | Thời gian giữ phòng sau `ENDED`. |
| `ROOM_EMPTY_TTL_MS` | number | `900000` (15m) | TTL cho phòng không còn ai kết nối. |
| `JANITOR_INTERVAL_MS` | number | `60000` (60s) | Chu kỳ quét dọn rác. |
| `TIMER_GRACE_MS` | number | `500` | Dung sai chấp nhận submit trễ do độ trễ mạng (so với `deadlineTs`). |
| `RATE_LIMIT_SUBMIT_MS` | number | `250` | Khoảng cách tối thiểu giữa 2 `submitAnswer`/socket (chống spam). |
| `RATE_LIMIT_REACTION_MS` | number | `500` | Throttle `sendReaction`/socket. |
| `LOG_LEVEL` | string | `info` | `debug`\|`info`\|`warn`\|`error`. |

#### A.5.2. Load & validate config (typed)

```typescript
// src/config/env.ts
import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
const num = (name: string, def: number) =>
  process.env[name] ? Number(process.env[name]) : def;

export const config = {
  port:            num("PORT", 3000),
  hostTokenSecret: required("HOST_TOKEN_SECRET"),
  corsOrigin:      (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  questionsPath:   process.env.QUESTIONS_PATH ?? "./data/questions.json",
  maxPlayers:      num("MAX_PLAYERS", 30),
  defaultMode:     (process.env.DEFAULT_MODE ?? "chuan") as GameMode,

  room: {
    idleTtlMs:    num("ROOM_IDLE_TTL_MS", 2 * 60 * 60 * 1000),
    endedGraceMs: num("ROOM_ENDED_GRACE_MS", 5 * 60 * 1000),
    emptyTtlMs:   num("ROOM_EMPTY_TTL_MS", 15 * 60 * 1000),
    janitorMs:    num("JANITOR_INTERVAL_MS", 60 * 1000),
  },

  timerGraceMs:       num("TIMER_GRACE_MS", 500),
  rateLimitSubmitMs:  num("RATE_LIMIT_SUBMIT_MS", 250),
  rateLimitReactMs:   num("RATE_LIMIT_REACTION_MS", 500),
  logLevel:           process.env.LOG_LEVEL ?? "info",
} as const;
```

File mẫu `.env.example`:

```dotenv
PORT=3000
HOST_TOKEN_SECRET=thay-bang-chuoi-bi-mat-dai-ngau-nhien
CORS_ORIGIN=http://localhost:5173,https://event.tiximax.net
QUESTIONS_PATH=./data/questions.json
MAX_PLAYERS=30
DEFAULT_MODE=chuan
ROOM_IDLE_TTL_MS=7200000
ROOM_ENDED_GRACE_MS=300000
ROOM_EMPTY_TTL_MS=900000
JANITOR_INTERVAL_MS=60000
TIMER_GRACE_MS=500
RATE_LIMIT_SUBMIT_MS=250
RATE_LIMIT_REACTION_MS=500
LOG_LEVEL=info
```

Ràng buộc khởi động: nếu **`HOST_TOKEN_SECRET` trống** hoặc **`questions.json` không đủ 40 câu / sai phân bổ trạm (7/6/9/7/11) / thiếu đáp án**, server **fail-fast** (không listen), để tránh chạy với hợp đồng dữ liệu sai.

---

## B. Tầng Socket.io: Handler & Máy trạng thái

> Tầng này là **nguồn chân lý duy nhất** của ván chơi. Server giữ `roomState` in-memory, quyết định mọi transition phase, chấm điểm server-side và đặt deadline. Client chỉ render theo `roomState` + các event nhận được. Mọi tên event / tên state / tên field trong phần này **giữ nguyên đúng hợp đồng ở Phần A** — BE không được đổi tên.

---

### B.0. Nguyên tắc bất di bất dịch (nhắc lại để guard chiếu theo)

1. **Không rò đáp án**: payload gửi cho `player` (đặc biệt `stationOpened`) đã **lược đáp án** (`correct` / `isTrue` / `correctBucket`). Đáp án chỉ đi qua `answerRevealed`; `explain`/`knowledgeCard` chỉ đi qua `knowledgeCard` (sau reveal).
2. **Timer đồng bộ bằng `deadlineTs`** (epoch ms tuyệt đối do server phát). Server **tự động khóa** khi hết giờ.
3. **`submitAnswer` idempotent theo `questionId`**: gửi lại (do reconnect / double-tap) không cộng điểm 2 lần; chỉ lấy **lần hợp lệ đầu tiên trước deadline**.
4. **Client không tự chấm**: toàn bộ chấm điểm & đáp án đúng nằm ở server.
5. **Map Boss**: `questions.json` dùng `station: 6` cho Boss; trên socket/`StationId` dùng `"boss"`. BE map `6 <-> "boss"` tại biên đọc dữ liệu.

---

### B.1. Khởi tạo Socket.io server & mô hình room/role

**Stack:** Node.js + Socket.io v4 (trên Express/Fastify) + TypeScript, **1 instance**, state **in-memory** (không DB cho MVP), chấm điểm **server-side**, ~30 người/phòng.

**Cấu trúc room (dùng Socket.io rooms, không dùng nhiều namespace):**

Mỗi phòng `roomCode` sinh 4 room logic để broadcast đúng đối tượng:

| Room key | Thành viên | Dùng để |
|---|---|---|
| `room:{roomCode}` | tất cả socket trong phòng | broadcast chung (`roomState`, `leaderboardUpdate`, `reactionBroadcast`…) |
| `{roomCode}:players` | role `player` | event dành riêng người chơi (`stationOpened` bản public, `timerSync`) |
| `{roomCode}:screens` | role `screen` | màn chiếu (`stationOpened`, `answerRevealed` bản stats, `leaderboardUpdate`) |
| `{roomCode}:host` | role `host` đã xác thực | phản hồi điều khiển, cảnh báo |

- **`yourResult` (kết quả cá nhân)** được emit **trực tiếp tới socket của player đó** (`io.to(socketId)`), không broadcast, để không lộ điểm người khác và không lộ đáp án cho `screen`.
- **`socket.data`** giữ: `{ roomCode, role, playerId, hostAuthed }`.

**State in-memory chính (một `RoomState` cho mỗi `roomCode`):**

```ts
interface RoomState {
  roomCode: string;
  phase: GamePhase;              // 1 trong 16 state — nguồn chân lý
  mode: GameMode;               // lite | chuan | fallback | no-projector
  currentStation: StationId | null;      // 1..4 | "boss"
  currentQuestionId: string | null;
  resumePhase?: GamePhase;      // để quay lại sau PAUSED/FALLBACK
  serverNow(): number;          // Date.now()

  players: Map<PlayerId, Player>;         // playerId -> {nickname,avatar,teamId,connected,score,streak,socketIds:Set}
  tokens: Map<ReconnectToken, PlayerId>;  // token -> playerId
  hostSecret: string;                     // so khớp hostToken

  // timer
  timer?: { questionId: string; deadlineTs: number; durationSec: number;
            handle: NodeJS.Timeout; remainingMsOnPause?: number };

  // đáp án đã nộp (idempotent): questionId -> playerId -> record
  submissions: Map<string, Map<PlayerId, SubmissionRecord>>;

  // ngân hàng câu hỏi (bản ĐẦY ĐỦ có đáp án — KHÔNG bao giờ gửi cho player)
  bank: Map<string, FullQuestion>;
  stationQueue: Map<StationId, string[]>; // thứ tự questionId trong mỗi trạm
  cursor: Map<StationId, number>;         // con trỏ câu hỏi hiện tại trong trạm
}
```

**Helper emit chuẩn (dùng xuyên suốt):**

```ts
const toAll     = (r) => io.to(`room:${r}`);
const toPlayers = (r) => io.to(`${r}:players`);
const toScreens = (r) => io.to(`${r}:screens`);
const toHost    = (r) => io.to(`${r}:host`);
const toSocket  = (id) => io.to(id);
```

---

### B.2. Máy trạng thái (State Machine)

**16 phase (đúng hợp đồng):** `LOBBY`, `TEAM_SELECT`, `INTRO`, `STATION_OPEN`, `ANSWERING`, `LOCKED`, `REVEAL`, `KNOWLEDGE_CARD`, `LEADERBOARD`, `BOSS_INTRO`, `BOSS_ANSWERING`, `BOSS_REVEAL`, `VICTORY`, `ENDED`, `PAUSED`, `FALLBACK`.

**Mode (cross-cutting, KHÔNG phải phase):** `lite | chuan | fallback | no-projector` — đổi qua `setMode`, phát `modeChanged`. Đổi mode không đổi `phase` (trừ khi host chủ động).

**Nguyên tắc transition:**
- Phần lớn transition **do HOST** kích hoạt (đã xác thực `hostToken`).
- `LOCKED` có thể do **SERVER** (hết giờ — deadline) **hoặc** host `lockAnswers`.
- `PAUSED`/`FALLBACK` là **overlay/mode**: khi vào, server lưu `resumePhase = phase hiện tại`; khi thoát, quay lại đúng `resumePhase`.

**Sơ đồ vòng lặp một trạm (Trạm 1→4):**

```
STATION_OPEN --startAnswering--> ANSWERING --(deadline|lockAnswers)--> LOCKED
   --revealAnswer--> REVEAL --showKnowledgeCard--> KNOWLEDGE_CARD
   --openStation (còn câu trong trạm)--> STATION_OPEN   (lặp cho từng câu)
   --showLeaderboard (hết câu trong trạm)--> LEADERBOARD
       --nextStation (còn trạm)--> STATION_OPEN (trạm kế)
       --startBoss (hết 4 trạm)--> BOSS_INTRO
```

**Sơ đồ Boss (station "boss", 11 câu):**

```
BOSS_INTRO --startAnswering(bossQ)--> BOSS_ANSWERING
   --(deadline|lockAnswers)--> (khóa nội bộ) --revealAnswer--> BOSS_REVEAL
   --startAnswering(bossQ kế) (còn câu)--> BOSS_ANSWERING ...
   --showLeaderboard (hết 11 câu)--> LEADERBOARD --endGame--> VICTORY --> ENDED
```

**Ghi chú thiết kế về các phase dẫn truyện (bám sát bộ host action tối giản của hợp đồng):**
- `startGame` (từ `LOBBY`) → **`TEAM_SELECT`** (mở chọn đội).
- Khi host mở trạm đầu tiên bằng `openStation({station:1})` từ `TEAM_SELECT`: server đi qua **`INTRO`** (transient, dừng ở INTRO để chiếu dẫn nhập) rồi sang **`STATION_OPEN`** khi host mở câu. Ở `mode: "lite"`, INTRO được **bỏ qua** (đi thẳng `STATION_OPEN`).
- Boss **bỏ bước STATION_OPEN preview**: host gọi `startAnswering` thẳng cho câu boss → `stationOpened(phase:"BOSS_ANSWERING")` kèm `timerSync` (vì enum `phase` của `stationOpened` có sẵn `"BOSS_ANSWERING"`).
- `VICTORY` là phase **celebration do server điều khiển**: `endGame` từ `LEADERBOARD` cuối → phát `gameEnded` + `roomState(VICTORY)`, sau đó server tự chuyển `ENDED` (terminal).

**Bảng host action → phase trước/sau:**

| Host event | Guard phase trước | Phase sau |
|---|---|---|
| `startGame` | LOBBY | TEAM_SELECT |
| `openStation({station})` | TEAM_SELECT / INTRO / REVEAL / KNOWLEDGE_CARD (còn câu) | STATION_OPEN (qua INTRO nếu lần đầu, trừ lite) |
| `startAnswering({questionId})` | STATION_OPEN | ANSWERING |
| `startAnswering({questionId})` (boss) | BOSS_INTRO / BOSS_REVEAL (còn câu) | BOSS_ANSWERING |
| `lockAnswers({questionId})` | ANSWERING | LOCKED |
| `lockAnswers({questionId})` (boss) | BOSS_ANSWERING | (khóa nội bộ, giữ BOSS_ANSWERING+locked) |
| `revealAnswer({questionId})` | LOCKED (hoặc ANSWERING đã locked) | REVEAL |
| `revealAnswer({questionId})` (boss) | BOSS_ANSWERING(locked) | BOSS_REVEAL |
| `showKnowledgeCard({questionId})` | REVEAL | KNOWLEDGE_CARD |
| `showLeaderboard()` | KNOWLEDGE_CARD / REVEAL / BOSS_REVEAL | LEADERBOARD |
| `nextStation()` | LEADERBOARD (còn trạm) | STATION_OPEN (trạm kế) |
| `startBoss()` | LEADERBOARD (sau trạm 4) | BOSS_INTRO |
| `pauseGame()` | bất kỳ phase chơi | PAUSED (lưu resumePhase) |
| `resumeGame()` | PAUSED | = resumePhase |
| `setMode({mode})` | bất kỳ | giữ phase; nếu `mode:"fallback"` có thể set overlay FALLBACK |
| `endGame()` | LEADERBOARD (sau boss) hoặc bất kỳ (dừng khẩn) | VICTORY → ENDED |

---

### B.3. Handler cho từng event CLIENT → SERVER

Với **mọi** handler: bọc trong `try/catch`, và bất kỳ vi phạm nào → `errorEvent({code, message, fatal})` gửi **về đúng socket gây lỗi** (không broadcast). Guard chung cho host action: `assertHost(socket)` (xem B.3.7).

#### B.3.1. `joinRoom({roomCode, role, reconnectToken?}, ack)`
- **Input:** `roomCode`, `role ∈ {player,screen,host}`, `reconnectToken?`. Với `role:"host"`, `hostToken` lấy từ `socket.handshake.auth.hostToken`.
- **Xác thực:**
  - `roomCode` tồn tại → nếu không: `ack({ok:false, error:"ROOM_NOT_FOUND"})`.
  - Nếu `role:"host"`: so khớp `hostToken === room.hostSecret`; sai → `ack({ok:false, error:"BAD_HOST_TOKEN"})`, **không** set `hostAuthed`.
  - Nếu có `reconnectToken` hợp lệ → chuyển sang luồng rejoin (B.6), trả lại `playerId` cũ.
- **Guard phase:** `player`/`screen` join được ở **mọi** phase (cho phép vào muộn / màn chiếu bật trễ). Nhưng chỉ được **chơi** (chọn đội / trả lời) khi phase phù hợp.
- **Tác động state:** join socket vào `room:{roomCode}` + room-role tương ứng; set `socket.data`. Nếu player mới: tạo `playerId`, `reconnectToken`, `player = {connected:true, score:0, streak:0, teamId:null}`.
- **Emit:**
  - `ack({ok:true, playerId, reconnectToken})`.
  - Gửi **về socket**: `roomState({...})` (snapshot hiện tại).
  - Broadcast `playerList` (cập nhật `counts`, `connected`).

#### B.3.2. `setNickname({nickname, avatar?})`
- **Guard:** phải đã `joinRoom` (`socket.data.playerId` tồn tại), role `player`; cho phép ở `LOBBY`/`TEAM_SELECT` (và cả sau đó để đổi tên nhẹ). Chống nickname rỗng/quá dài/trùng (thêm hậu tố).
- **Tác động:** cập nhật `player.nickname/avatar`.
- **Emit:** broadcast `playerList`.

#### B.3.3. `chooseTeam({teamId})`
- **Input:** `teamId ∈ 1..6`.
- **Xác thực + Guard:** role `player`; **chỉ nhận khi `phase === TEAM_SELECT`** (ngoài phase này → `errorEvent({code:"WRONG_PHASE"})`). Kiểm `teamId` hợp lệ; có thể chặn đội quá tải để cân bằng (tùy `mode`).
- **Tác động:** `player.teamId = teamId`.
- **Emit:** `teamAssigned({playerId, teamId, teamName})` **về socket player** + broadcast `playerList` (cập nhật `perTeam`).

#### B.3.4. `submitAnswer({questionId, answer, clientSentAt}, ack)` — **quan trọng nhất**
- **Input:** `questionId`, `answer: AnswerPayload` (đúng biến thể theo `type`), `clientSentAt`.
- **Guard (bắt buộc):**
  1. `phase === ANSWERING` **hoặc** `phase === BOSS_ANSWERING`. Sai → `ack({ok:false, received:false, error:"NOT_ANSWERING"})`.
  2. `questionId === roomState.currentQuestionId`. Sai (câu cũ) → `ack({ok:false, error:"STALE_QUESTION"})`.
  3. `serverNow() <= timer.deadlineTs` (**dùng giờ server**, bỏ qua `clientSentAt` để chấm; `clientSentAt` chỉ để đo lệch/telemetry). Trễ → `ack({ok:false, received:false, error:"DEADLINE_PASSED"})`.
  4. `player.teamId != null` (đã có đội).
- **Idempotent:** trong `submissions[questionId][playerId]`:
  - Nếu đã tồn tại record **hợp lệ trước deadline** → **không ghi đè, không chấm lại**; chỉ `ack({ok:true, received:true})` (double-tap/reconnect an toàn).
  - Nếu chưa có → ghi `{answer, serverReceivedAt: serverNow(), scored:false}`.
- **Tác động:** **KHÔNG chấm điểm ngay** (chấm dồn ở `revealAnswer`/hết giờ để đồng loạt) — chỉ lưu bản nộp + đóng dấu `serverReceivedAt` (phục vụ thưởng tốc độ).
- **Emit:**
  - `ack({ok:true, received:true})`.
  - `answerAck({questionId, received:true, serverReceivedAt})` **về socket player** (biên nhận hiển thị "đã nhận").
  - (Tùy chọn) cập nhật `answeredCount` nội bộ để dùng khi lock.

#### B.3.5. `sendReaction({emoji})`
- **Guard:** đã join, role `player`; whitelist emoji + **rate-limit** (vd ≤ 3/giây/người) chống spam.
- **Emit:** `reactionBroadcast({emoji, teamId, nickname?})` broadcast `room:{roomCode}` (cho screen + player thấy).

#### B.3.6. `rejoin({reconnectToken}, ack)` → xem chi tiết **B.6**.

#### B.3.7. HOST actions (server kiểm `hostToken`)
`assertHost(socket)`: yêu cầu `socket.data.role==="host" && socket.data.hostAuthed===true`. Thất bại → `errorEvent({code:"NOT_HOST", fatal:false})` và **bỏ qua** lệnh. Mỗi host action còn có **guard phase** (bảng B.2). Chi tiết emit của từng host action nằm ở B.4 (theo phase đích).

| Host event | Input | Xác thực/Guard | Effect chính |
|---|---|---|---|
| `startGame` | `{roomCode}` | host + phase=LOBBY | phase→TEAM_SELECT |
| `openStation` | `{station}` | host + phase∈{TEAM_SELECT,INTRO,REVEAL,KNOWLEDGE_CARD} | chọn câu kế trong trạm (map `6<->"boss"`), phase→STATION_OPEN |
| `startAnswering` | `{questionId}` | host + phase=STATION_OPEN (hoặc BOSS_INTRO/BOSS_REVEAL cho boss) + questionId=current | đặt `timer`, phase→ANSWERING/BOSS_ANSWERING |
| `lockAnswers` | `{questionId}` | host + phase=ANSWERING/BOSS_ANSWERING | khóa nhận nộp, phase→LOCKED (boss: set locked) |
| `revealAnswer` | `{questionId}` | host + phase=LOCKED/(boss locked) | **chấm điểm**, phase→REVEAL/BOSS_REVEAL |
| `showKnowledgeCard` | `{questionId}` | host + phase=REVEAL | phase→KNOWLEDGE_CARD |
| `showLeaderboard` | `()` | host + phase∈{REVEAL,KNOWLEDGE_CARD,BOSS_REVEAL} | phase→LEADERBOARD |
| `nextStation` | `()` | host + phase=LEADERBOARD + còn trạm | `currentStation++`, phase→STATION_OPEN |
| `startBoss` | `()` | host + phase=LEADERBOARD + hết 4 trạm | `currentStation="boss"`, phase→BOSS_INTRO |
| `pauseGame` | `()` | host | lưu resumePhase, **freeze timer**, phase→PAUSED |
| `resumeGame` | `()` | host + phase=PAUSED | **re-arm timer**, phase→resumePhase |
| `setMode` | `{mode}` | host | đổi `mode`, phát `modeChanged` |
| `endGame` | `()` | host | phase→VICTORY→ENDED |

---

### B.4. Server emit gì khi vào mỗi phase (side-effect theo phase)

Mỗi khi `setPhase(newPhase)`, server **luôn** broadcast `roomState({roomCode, phase, mode, currentStation, currentQuestionId, serverNow, resumePhase?})` tới `room:{roomCode}`, **rồi** phát thêm event đặc thù phase:

| Phase (khi vừa vào) | Event đặc thù + đối tượng nhận |
|---|---|
| `LOBBY` | `playerList` (broadcast) |
| `TEAM_SELECT` | `playerList` (broadcast); màn chiếu hiện lưới đội |
| `INTRO` | chỉ `roomState` (screen chiếu dẫn nhập); bỏ qua ở `lite` |
| `STATION_OPEN` | `stationOpened({question: PublicQuestion đã lược đáp án, phase:"STATION_OPEN"})` → `players` + `screens` |
| `ANSWERING` | `stationOpened({question, phase:"ANSWERING"})` (cho ai vào muộn) + **`timerSync({questionId, deadlineTs, serverNow, durationSec})`** → `players` + `screens` |
| `LOCKED` | `answerLocked({questionId, answeredCount, totalPlayers})` → broadcast |
| `REVEAL` | `answerRevealed({questionId, type, correct, stats, yourResult?})`: **bản `correct`+`stats`** → `screens` (và `players` phần chung); **`yourResult` riêng từng player** → `toSocket(playerId)` |
| `KNOWLEDGE_CARD` | `knowledgeCard({questionId, explain, knowledgeCard})` → broadcast (screen + player) |
| `LEADERBOARD` | `leaderboardUpdate({players[], teams[], shipPositions[]})` → broadcast |
| `BOSS_INTRO` | `bossPhase({phase:"BOSS_INTRO", pointsMultiplier:2, title})` → broadcast |
| `BOSS_ANSWERING` | `stationOpened({question, phase:"BOSS_ANSWERING"})` + `bossPhase({phase:"BOSS_ANSWERING", pointsMultiplier:2, title})` + `timerSync(...)` |
| `BOSS_REVEAL` | `answerRevealed(...)` (giống REVEAL, điểm đã ×2) + `bossPhase({phase:"BOSS_REVEAL", pointsMultiplier:2})` |
| `VICTORY` | `gameEnded({winnerTeam, topPlayers, finalTeams})` → broadcast |
| `ENDED` | `roomState(phase:"ENDED")`; đóng nhận input (terminal) |
| `PAUSED` | `roomState(phase:"PAUSED", resumePhase)`; screen hiện overlay tạm dừng |
| `FALLBACK` | `modeChanged({mode:"fallback", reason})` + `roomState(phase:"FALLBACK", resumePhase)` |

> **Chống rò đáp án (nhắc):** `stationOpened` dựng `PublicQuestion` bằng cách chiếu `FullQuestion` **bỏ** mọi field đáp án (`correct`, `isTrue`, `correctBucket`, `explain`, `knowledgeCard`, `commonMistake`). Chỉ giữ `options[{id,text}]` / `statements[{id,text}]` / `buckets[{id,name}]` / `items[{id,text}]`.

---

### B.5. Đồng bộ Timer server-side

**Nguyên tắc:** thời gian đồng bộ **chỉ bằng `deadlineTs`** (epoch ms tuyệt đối). Client tự đếm ngược = `deadlineTs - Date.now()` (đã bù lệch qua `serverNow` trong `timerSync`). Server không tin giờ client.

**Bắt đầu (khi `startAnswering`):**
```ts
function armTimer(room, q) {
  const durationSec = q.timeLimitSec;
  const deadlineTs = room.serverNow() + durationSec * 1000;
  const handle = setTimeout(() => onDeadline(room, q.questionId), durationSec * 1000);
  room.timer = { questionId: q.questionId, deadlineTs, durationSec, handle };
  const payload = { questionId: q.questionId, deadlineTs,
                    serverNow: room.serverNow(), durationSec };
  toPlayers(room.roomCode).emit("timerSync", payload);
  toScreens(room.roomCode).emit("timerSync", payload);
}
```

**Tự động khóa khi hết giờ (SERVER-driven LOCKED):**
```ts
function onDeadline(room, questionId) {
  if (room.timer?.questionId !== questionId) return; // đã đổi câu, bỏ qua
  if (room.phase === "ANSWERING")      setPhase(room, "LOCKED");
  else if (room.phase === "BOSS_ANSWERING") room.timer.locked = true; // boss giữ phase, set cờ locked
  const answeredCount = room.submissions.get(questionId)?.size ?? 0;
  toAll(room.roomCode).emit("answerLocked",
    { questionId, answeredCount, totalPlayers: connectedCount(room) });
}
```
> `lockAnswers` (host) gọi cùng nhánh này thủ công (clear `setTimeout` để không double-fire). Sau `LOCKED`, `submitAnswer` bị guard `NOT_ANSWERING` từ chối.

**PAUSED — giữ/lùi deadline:**
```ts
function pause(room) {
  room.resumePhase = room.phase;
  if (room.timer) {
    clearTimeout(room.timer.handle);
    room.timer.remainingMsOnPause = Math.max(0, room.timer.deadlineTs - room.serverNow());
  }
  setPhase(room, "PAUSED"); // broadcast roomState(resumePhase)
}
function resume(room) {
  const back = room.resumePhase!;
  if (room.timer?.remainingMsOnPause != null) {
    const rem = room.timer.remainingMsOnPause;
    room.timer.deadlineTs = room.serverNow() + rem;     // dời deadline đúng phần còn lại
    room.timer.handle = setTimeout(() => onDeadline(room, room.timer!.questionId), rem);
    delete room.timer.remainingMsOnPause;
    emitTimerSync(room); // client đồng bộ lại deadline mới
  }
  setPhase(room, back);
}
```
> `FALLBACK`/`no-projector`: timer vẫn chạy server-side; ở `no-projector` server vẫn phát `timerSync` để player tự thấy đồng hồ trên máy mình (không cần màn chiếu).

---

### B.6. Luồng reconnect & disconnect

**`disconnect` (mất kết nối):**
```ts
socket.on("disconnect", () => {
  const { roomCode, playerId } = socket.data;
  const p = room.players.get(playerId);
  p.socketIds.delete(socket.id);
  if (p.socketIds.size === 0) p.connected = false; // KHÔNG xóa player, KHÔNG mất điểm
  toAll(roomCode).emit("playerList", buildPlayerList(room));
  // dọn dẹp thực sự chỉ khi phase===ENDED (hoặc TTL dài) — MVP giữ nguyên state
});
```

**`rejoin({reconnectToken}, ack)`:**
```ts
socket.on("rejoin", ({ reconnectToken }, ack) => {
  const playerId = room.tokens.get(reconnectToken);
  if (!playerId) return ack({ ok:false, error:"BAD_TOKEN" });
  const p = room.players.get(playerId);
  bindSocket(socket, room, playerId, p.role);   // join lại room + role, connected=true
  ack({ ok:true });

  // 1) luôn gửi snapshot hiện tại
  toSocket(socket.id).emit("roomState", buildRoomState(room));
  toAll(room.roomCode).emit("playerList", buildPlayerList(room));

  // 2) nếu đang ANSWERING/BOSS_ANSWERING: gửi lại câu hỏi + timer để client dựng lại màn trả lời
  if (room.phase === "ANSWERING" || room.phase === "BOSS_ANSWERING") {
    const q = publicQuestion(room.bank.get(room.currentQuestionId)); // đã lược đáp án
    const phase = room.phase === "BOSS_ANSWERING" ? "BOSS_ANSWERING" : "ANSWERING";
    toSocket(socket.id).emit("stationOpened", { question: q, phase });
    toSocket(socket.id).emit("timerSync", {
      questionId: room.timer.questionId, deadlineTs: room.timer.deadlineTs,
      serverNow: room.serverNow(), durationSec: room.timer.durationSec });
    // nếu player ĐÃ nộp câu này → gửi answerAck để client khóa nút, tránh nộp lại
    if (room.submissions.get(room.currentQuestionId)?.has(playerId))
      toSocket(socket.id).emit("answerAck",
        { questionId: room.currentQuestionId, received:true, serverReceivedAt: /*đã lưu*/ });
  }
  // nếu đang REVEAL/KNOWLEDGE_CARD/LEADERBOARD: gửi lại đúng event tương ứng (idempotent)
});
```
> **Giữ điểm & idempotent:** vì `submissions[questionId][playerId]` đã lưu, người reconnect **không** cộng điểm lần 2 (guard B.3.4). Reconnect giữa lúc reveal vẫn nhận đúng `yourResult` đã tính.

---

### B.7. Chấm điểm server-side (thực thi khi `revealAnswer`)

Chấm **một lần** cho mỗi câu, khi vào `REVEAL`/`BOSS_REVEAL`, duyệt mọi bản nộp hợp lệ:

```ts
function scoreQuestion(room, q /*FullQuestion*/) {
  const subs = room.submissions.get(q.questionId) ?? new Map();
  const isBoss = q.station === "boss"; // (đọc từ station 6)
  for (const [playerId, rec] of subs) {
    if (rec.scored) continue;                         // idempotent
    const { isCorrect, correctness } = grade(q, rec.answer); // correctness ∈ [0..1] (partial)
    // điểm nền theo mức đúng (partial cho truefalse/dragdrop/matching)
    let pts = q.basePoints * correctness;
    // thưởng TỐC ĐỘ: theo thời gian CÒN LẠI so với deadline
    const remainRatio = clamp01((room.timer.deadlineTs - rec.serverReceivedAt)
                                 / (q.timeLimitSec * 1000));
    const speedBonus = Math.round(q.basePoints * 0.5 * remainRatio * correctness);
    pts += speedBonus;
    // COMBO/STREAK: chuỗi đúng liên tiếp
    const p = room.players.get(playerId);
    p.streak = isCorrect ? p.streak + 1 : 0;
    const streakMult = 1 + Math.min(p.streak, 5) * 0.1;   // vd tối đa +50%
    pts = Math.round(pts * streakMult);
    // BOSS ×pointsMultiplier
    if (isBoss) pts *= (q.pointsMultiplier ?? 2);

    p.score += pts;
    rec.scored = true;
    // gửi kết quả CÁ NHÂN (không lộ cho người khác)
    toSocket(anySocketOf(p)).emit("answerRevealed", {
      questionId: q.questionId, type: q.type, correct: publicCorrect(q), stats: buildStats(room,q),
      yourResult: { isCorrect, pointsEarned: pts, speedBonus, streak: p.streak }
    });
  }
  // gửi phần CHUNG (correct + stats, KHÔNG yourResult) cho screen + player chưa nộp
  const common = { questionId:q.questionId, type:q.type, correct:publicCorrect(q), stats:buildStats(room,q) };
  toScreens(room.roomCode).emit("answerRevealed", common);
}
```

**`grade(q, answer)` theo `type` (dùng bản đầy đủ trong `bank`):**
- `mcq`: `isCorrect = answer.optionId === q.correct`; `correctness ∈ {0,1}`.
- `selectwrong`: `isCorrect = answer.optionId === q.correct` (ở đây `q.correct` = id **phương án SAI** cần chọn).
- `truefalse`: so từng `statementId` với `q.statements[].isTrue`; `correctness = (# đúng)/(# statements)`; `isCorrect = correctness===1`.
- `dragdrop`/`matching`: so từng `itemId → bucketId` với `q.items[].correctBucket`; `correctness = (# item đúng)/(# items)`; `isCorrect = correctness===1`.

**`stats` (bản public, không lộ danh tính):** `optionPct` (mcq/selectwrong), `statementCorrectPct` (truefalse), `bucketCorrectPct` (dragdrop/matching), và luôn có `classCorrectPct` (tỉ lệ cả lớp đúng).

**`shipPositions` (leaderboard):** `progress = stationReached / 4` (0..1) theo tiến độ đội; cập nhật mỗi `LEADERBOARD`.

---

### B.8. Bảng tóm tắt: Event → Guard → Phase trước/sau → Emit

| # | Event (from) | Guard chính | Phase trước → sau | Server EMIT (→ ai) |
|---|---|---|---|---|
| 1 | `joinRoom` (client) | roomCode hợp lệ; host cần hostToken | (giữ nguyên) | `ack`; `roomState`(→socket); `playerList`(broadcast) |
| 2 | `setNickname` (player) | đã join; LOBBY/TEAM_SELECT | (giữ) | `playerList`(broadcast) |
| 3 | `chooseTeam` (player) | phase=TEAM_SELECT; teamId hợp lệ | (giữ) | `teamAssigned`(→socket); `playerList`(broadcast) |
| 4 | `submitAnswer` (player) | phase∈{ANSWERING,BOSS_ANSWERING}; questionId=current; `now≤deadlineTs`; idempotent | (giữ) | `ack`; `answerAck`(→socket) |
| 5 | `sendReaction` (player) | đã join; rate-limit | (giữ) | `reactionBroadcast`(broadcast) |
| 6 | `rejoin` (client) | token hợp lệ | (giữ) | `roomState`,`stationOpened`,`timerSync`(→socket); `playerList` |
| 7 | `startGame` (host) | host; LOBBY | LOBBY→TEAM_SELECT | `roomState`; `playerList` |
| 8 | `openStation` (host) | host; TEAM_SELECT/INTRO/REVEAL/KNOWLEDGE_CARD | →STATION_OPEN | `roomState`; `stationOpened`(phase=STATION_OPEN, đã lược đáp án) |
| 9 | `startAnswering` (host) | host; STATION_OPEN (hoặc BOSS_INTRO/BOSS_REVEAL) | →ANSWERING/BOSS_ANSWERING | `roomState`; `stationOpened`(ANSWERING/BOSS_ANSWERING); **`timerSync`** |
| 10 | `lockAnswers` (host) **hoặc SERVER (deadline)** | ANSWERING/BOSS_ANSWERING | →LOCKED (boss: set locked) | `roomState`; `answerLocked` |
| 11 | `revealAnswer` (host) | LOCKED / boss-locked | →REVEAL/BOSS_REVEAL | **chấm điểm**; `answerRevealed`(correct+stats→screen; `yourResult`→từng player) |
| 12 | `showKnowledgeCard` (host) | REVEAL | →KNOWLEDGE_CARD | `roomState`; `knowledgeCard` |
| 13 | `showLeaderboard` (host) | REVEAL/KNOWLEDGE_CARD/BOSS_REVEAL | →LEADERBOARD | `roomState`; `leaderboardUpdate` |
| 14 | `nextStation` (host) | LEADERBOARD; còn trạm | →STATION_OPEN | `roomState`; `stationOpened` |
| 15 | `startBoss` (host) | LEADERBOARD; hết 4 trạm | →BOSS_INTRO | `roomState`; `bossPhase`(pointsMultiplier=2) |
| 16 | `pauseGame` (host) | host | *→PAUSED (lưu resumePhase, freeze timer) | `roomState`(resumePhase) |
| 17 | `resumeGame` (host) | PAUSED | PAUSED→resumePhase (re-arm timer) | `roomState`; `timerSync`(nếu đang answering) |
| 18 | `setMode` (host) | host | giữ phase (fallback→overlay FALLBACK) | `modeChanged` |
| 19 | `endGame` (host) | host | →VICTORY→ENDED | `gameEnded`; `roomState`(VICTORY→ENDED) |

---

### B.9. Pseudocode xương sống (state machine tập trung)

Mọi transition đi qua **một** hàm `setPhase` để đảm bảo luôn broadcast `roomState` + side-effect nhất quán:

```ts
function setPhase(room, next: GamePhase) {
  room.phase = next;
  toAll(room.roomCode).emit("roomState", buildRoomState(room)); // luôn broadcast trước
  switch (next) {
    case "STATION_OPEN": {
      const q = publicQuestion(currentQuestion(room));
      toPlayers(room.roomCode).emit("stationOpened", { question:q, phase:"STATION_OPEN" });
      toScreens(room.roomCode).emit("stationOpened", { question:q, phase:"STATION_OPEN" });
      break; }
    case "ANSWERING":
    case "BOSS_ANSWERING": {
      const q = publicQuestion(currentQuestion(room));
      const phase = next;
      toPlayers(room.roomCode).emit("stationOpened", { question:q, phase });
      toScreens(room.roomCode).emit("stationOpened", { question:q, phase });
      armTimer(room, currentQuestion(room));                  // → phát timerSync
      if (next === "BOSS_ANSWERING")
        toAll(room.roomCode).emit("bossPhase",
          { phase:"BOSS_ANSWERING", pointsMultiplier:2, title:bossTitle(room) });
      break; }
    case "LOCKED":
      toAll(room.roomCode).emit("answerLocked", lockPayload(room)); break;
    case "REVEAL":
    case "BOSS_REVEAL":
      scoreQuestion(room, currentQuestion(room));             // chấm + phát answerRevealed
      if (next === "BOSS_REVEAL")
        toAll(room.roomCode).emit("bossPhase", { phase:"BOSS_REVEAL", pointsMultiplier:2, title:bossTitle(room) });
      break;
    case "KNOWLEDGE_CARD": {
      const fq = currentQuestion(room);
      toAll(room.roomCode).emit("knowledgeCard",
        { questionId:fq.questionId, explain:fq.explain, knowledgeCard:fq.knowledgeCard });
      break; }
    case "LEADERBOARD":
      toAll(room.roomCode).emit("leaderboardUpdate", buildLeaderboard(room)); break;
    case "BOSS_INTRO":
      toAll(room.roomCode).emit("bossPhase", { phase:"BOSS_INTRO", pointsMultiplier:2, title:bossTitle(room) });
      break;
    case "VICTORY":
      toAll(room.roomCode).emit("gameEnded", buildGameEnded(room));
      setImmediate(() => setPhase(room, "ENDED"));            // auto-advance terminal
      break;
    case "ENDED": /* đóng nhận input, giữ state để hiển thị */ break;
    case "PAUSED":  /* đã freeze timer ở pause() */ break;
    case "FALLBACK":
      toAll(room.roomCode).emit("modeChanged", { mode:"fallback", reason:"host_fallback" }); break;
  }
}
```

**Bất biến kiểm tra trước khi ship (checklist BE):**
- [ ] `stationOpened`/`timerSync` gửi cho `players` **không** chứa field đáp án nào.
- [ ] `submitAnswer` sau `deadlineTs` (giờ server) bị từ chối; nộp lại cùng `questionId` không cộng điểm 2 lần.
- [ ] Auto-lock bằng `setTimeout` khớp `deadlineTs`; `pauseGame` freeze, `resumeGame` dời deadline đúng phần còn lại và phát lại `timerSync`.
- [ ] Reconnect giữa `ANSWERING` dựng lại được màn trả lời (nhận `roomState`+`stationOpened`+`timerSync`), giữ nguyên điểm.
- [ ] Map `station 6 <-> "boss"` đúng ở biên đọc `questions.json`; boss chấm ×`pointsMultiplier`.
- [ ] Mọi host action đều qua `assertHost`; sai phase → `errorEvent`, không đổi state.

---

# C. Engine Chấm điểm, Chấm đúng & Phân tích

> Module server-side, **nguồn chân lý duy nhất** cho điểm số và đáp án. Client KHÔNG bao giờ tự chấm (quy tắc bất di bất dịch #4). Toàn bộ state in-memory (MVP, không DB). Tham chiếu chặt hợp đồng Socket.io ở Phần A: các event `submitAnswer`, `answerLocked`, `answerRevealed`, `leaderboardUpdate`, `timerSync`, `bossPhase` và các kiểu `AnswerPayload`, `PublicQuestion`, `GradeResult` đề xuất bên dưới.

Bố cục file (đề xuất, dưới `src/server/engine/`):

```
src/server/engine/
  questionStore.ts   // nạp questions.json (BẢN CÓ đáp án), map station 6 <-> "boss"
  grading.ts         // C.1 — chấm đúng theo type -> GradeResult
  scoring.ts         // C.2 — công thức điểm; C.3 — streak
  leaderboard.ts     // C.4, C.5 — điểm đội, ship progress, xếp hạng, payload
  analytics.ts       // C.6 — thống kê formative cho console giáo viên
  constants.ts       // hằng số điều chỉnh (SPEED_WEIGHT, COMBO_STEP...)
```

---

## C.0. Mô hình dữ liệu in-memory & vòng đời chấm

### C.0.1. Hằng số điều chỉnh (`constants.ts`)

| Hằng số | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `SPEED_WEIGHT` | `0.5` | Trần thưởng tốc độ = 50% `basePoints` (đáp tức thời + đúng hoàn toàn). |
| `COMBO_STEP` | `0.1` | Mỗi câu đúng liên tiếp cộng +10% hệ số combo. |
| `COMBO_CAP` | `0.5` | Trần combo +50% (streak ≥ 5 thì bão hoà). |
| `STREAK_PASS_RATIO` | `1.0` | Ngưỡng `correctRatio` để **nối chuỗi** streak. Mặc định phải ĐÚNG HOÀN TOÀN. (Chỉnh xuống `0.5` nếu muốn câu chấm-từng-phần đạt ≥50% vẫn giữ combo.) |
| `TOTAL_LEGS` | `5` | Số chặng hải trình: Trạm 1→4 + Boss. Cảng đích = sau Boss. |
| `INTRA_LEG` | `0.6` | Bề rộng "chạy đua trong chặng" theo điểm (tối đa 60% một chặng cho đội dẫn đầu). |
| `LEADERBOARD_PLAYER_CAP` | `20` | Số người tối đa gửi trong `leaderboardUpdate.players` (giảm băng thông; console/màn chiếu chỉ hiển thị top). |
| `MISCONCEPTION_THRESHOLD` | `0.6` | `classCorrectPct < 60%` → bật cờ ngộ nhận (khớp `MisconceptionFlag` của console). |

### C.0.2. Cấu trúc state (rút gọn)

```ts
// Bản ĐẦY ĐỦ (có đáp án) — chỉ tồn tại ở server
interface FullQuestion extends PublicQuestion {
  correct?: string;                    // mcq: id đúng | selectwrong: id SAI
  statements?: {id;text;isTrue:boolean}[];
  items?: {id;text;correctBucket:string}[];
  explain: string; knowledgeCard: {...}; commonMistake: string;
  pointsMultiplier?: number;           // boss = 2
}

interface Submission {
  playerId: string;
  answer: AnswerPayload;
  serverReceivedAt: number;   // Date.now() TẠI server — DUY NHẤT dùng để chấm tốc độ
  clientSentAt: number;       // chỉ để đo độ trễ/analytics, KHÔNG dùng chấm
  accepted: boolean;          // true nếu tới trước deadline (hợp lệ)
}

interface QuestionRuntime {
  questionId: string;
  deadlineTs: number;         // epoch ms tuyệt đối (Phần A: timerSync.deadlineTs)
  durationMs: number;         // timeLimitSec * 1000
  submissions: Map<playerId, Submission>;   // IDEMPOTENT theo (questionId, playerId)
  graded: boolean;            // khoá không chấm 2 lần (idempotent scoring)
  computed?: {                // cache kết quả để replay khi reconnect
    perPlayer: Map<playerId, YourResult>;
    stats: RevealStats;
    correct: RevealCorrect;
  };
}

interface PlayerState {
  playerId; nickname; avatar?; teamId: TeamId;
  connected: boolean;
  score: number;              // tổng tích luỹ
  streak: number;             // chuỗi đúng liên tiếp hiện tại
  answeredTotalMs: number;    // tổng thời gian đáp (tie-break xếp hạng)
  joinSeq: number;            // thứ tự join (tie-break ổn định cuối cùng)
}
```

### C.0.3. Vòng đời chấm (bám state machine Phần A)

1. **`startAnswering(questionId)`** (host): server đặt `deadlineTs = now + durationMs`, phát `timerSync({questionId, deadlineTs, serverNow, durationSec})`, và hẹn `setTimeout(deadlineTs - now)` để **tự khoá** (quy tắc #2).
2. **`ANSWERING`**: mỗi `submitAnswer` được ghi vào `submissions` theo luật idempotent + deadline (xem C.7).
3. **`LOCKED`** (server tự khoá khi hết giờ **hoặc** host `lockAnswers`): đóng băng `submissions`, phát `answerLocked({questionId, answeredCount, totalPlayers})`. **Chưa** lộ đáp án.
4. **`REVEAL`/`BOSS_REVEAL`** (host `revealAnswer`): chạy grading + scoring + cập nhật streak + điểm đội + stats **đúng một lần** (`graded` guard). Phát `answerRevealed` (kèm `yourResult` riêng từng người đã trả lời).
5. **`LEADERBOARD`** (host `showLeaderboard`): build & phát `leaderboardUpdate`.

> **Điểm/streak chỉ áp ở bước REVEAL**, không áp lúc submit. Nhờ vậy reconnect giữa chừng chỉ cần replay `timerSync` + trạng thái đã-nộp, không rủi ro cộng điểm sớm.

---

## C.1. Thuật toán CHẤM ĐÚNG (grading) theo `type`

Đầu ra chuẩn cho mọi type:

```ts
interface GradeResult {
  isCorrect: boolean;     // ĐÚNG HOÀN TOÀN (correctRatio === 1)
  correctRatio: number;   // 0..1 — phục vụ chấm từng phần
  correctCount?: number;  // số phần đúng (truefalse/dragdrop/matching)
  total?: number;         // tổng phần
}
```

Bộ điều phối:

```ts
function grade(q: FullQuestion, a: AnswerPayload): GradeResult {
  if (!a || a.type !== q.type) return { isCorrect:false, correctRatio:0 }; // payload lệch type -> 0
  switch (q.type) {
    case "mcq":        return gradeMcq(q, a);
    case "selectwrong":return gradeSelectWrong(q, a);
    case "truefalse":  return gradeTrueFalse(q, a);
    case "dragdrop":
    case "matching":   return gradePlacement(q, a);  // cùng thuật toán
  }
}
```

### C.1.1. `mcq` — so `optionId` với `correct`

```
gradeMcq(q, a):
  ok = (a.optionId === q.correct)      // q.correct = id phương án ĐÚNG
  return { isCorrect: ok, correctRatio: ok ? 1 : 0 }
```

### C.1.2. `selectwrong` — so `optionId` với `correct` (là id phương án SAI)

```
gradeSelectWrong(q, a):
  # LƯU Ý HỢP ĐỒNG: q.correct ở đây = id phương án SAI cần chọn
  ok = (a.optionId === q.correct)
  return { isCorrect: ok, correctRatio: ok ? 1 : 0 }
```

> Đáp án công bố ra client dùng khóa `correct.wrongOptionId` (không phải `optionId`) theo `answerRevealed` Phần A.

### C.1.3. `truefalse` — so từng nhận định với `isTrue`, ratio = đúng/tổng

```
gradeTrueFalse(q, a):
  total = q.statements.length
  correct = 0
  for st in q.statements:
     picked = a.answers[st.id]                 # boolean người chơi chọn
     if picked === undefined: continue         # bỏ trống = sai nhận định đó
     if picked === st.isTrue: correct += 1
  ratio = total > 0 ? correct / total : 0
  return { isCorrect: ratio === 1, correctRatio: ratio, correctCount: correct, total }
```

### C.1.4. `dragdrop` / `matching` — so từng item với `correctBucket`, ratio = đúng/tổng

```
gradePlacement(q, a):
  total = q.items.length
  correct = 0
  for it in q.items:
     placedBucket = a.placement[it.id]         # itemId -> bucketId người chơi đặt
     if placedBucket === it.correctBucket: correct += 1
  ratio = total > 0 ? correct / total : 0
  return { isCorrect: ratio === 1, correctRatio: ratio, correctCount: correct, total }
```

> `dragdrop` (kéo vào nhóm) và `matching` (ghép trái–phải) **cùng cấu trúc dữ liệu** (`items[].correctBucket`), nên dùng chung 1 hàm. Item thừa/không tồn tại trong payload bị bỏ qua; item thiếu tính là sai (không tăng `correct`).

---

## C.2. CÔNG THỨC TÍNH ĐIỂM

### C.2.1. Đầu vào cho mỗi lượt chấm

- `basePoints` (từ câu hỏi: 1000 Trạm 1–2, 1200 dragdrop Trạm 3, 1500 Boss mcq, 1700 Boss matching).
- `durationMs = timeLimitSec * 1000` (20/25/35/45s tuỳ câu).
- `remainingMs = clamp(deadlineTs - submission.serverReceivedAt, 0, durationMs)`.
- `speedFactor = remainingMs / durationMs` ∈ [0,1] (đáp càng sớm càng cao).
- `correctRatio` (từ C.1).
- `streakBefore` = streak người chơi trước câu này.
- `questionMultiplier = q.pointsMultiplier ?? 1` (Boss = 2).

### C.2.2. Công thức

```
# 1) Nội dung (chấm từng phần cho truefalse/dragdrop/matching)
contentBase = basePoints * correctRatio

# 2) Thưởng tốc độ — tỉ lệ theo thời gian CÒN LẠI và mức đúng
speedBase   = basePoints * SPEED_WEIGHT * speedFactor * correctRatio

# 3) Hệ số COMBO/STREAK (chỉ khi nối chuỗi — xem C.3)
streakAfter = passStreak(correctRatio) ? streakBefore + 1 : 0
comboMult   = passStreak(correctRatio) ? 1 + min(streakAfter * COMBO_STEP, COMBO_CAP) : 1

# 4) Nhân Boss
mult        = questionMultiplier

# 5) Tổng
pointsEarned = round( (contentBase + speedBase) * comboMult * mult )

# Phân rã để hiển thị (ResultScreen: pointsEarned lớn, speedBonus dòng phụ)
speedBonus   = round( speedBase * comboMult * mult )   # phần điểm do TỐC ĐỘ
# contentEarned = pointsEarned - speedBonus (đảm bảo cộng khớp)
```

Với `passStreak(ratio) = ratio >= STREAK_PASS_RATIO` (mặc định `=== 1`).

Các giá trị này lấp thẳng vào `answerRevealed.yourResult`:

```ts
yourResult = { isCorrect, pointsEarned, speedBonus, streak: streakAfter }
```

### C.2.3. Ví dụ tính số cụ thể

**VD-A — MCQ Trạm 1, đúng, đang có chuỗi.** `basePoints=1000`, `durationMs=20000`, đáp khi còn `remainingMs=15000` → `speedFactor=0.75`, `correctRatio=1`, `streakBefore=2` → `streakAfter=3`, `comboMult=1.3`, `mult=1`.
- `contentBase=1000`; `speedBase=1000·0.5·0.75·1=375`; tổng thô `1375`.
- `pointsEarned=round(1375·1.3·1)=1788`; `speedBonus=round(375·1.3)=488`. (Nội dung 1300 + tốc độ 488 = 1788 ✔)

**VD-B — Boss `matching`, đúng 4/5, chuỗi đứt.** `basePoints=1700`, `durationMs=45000`, `remainingMs=30000`→`speedFactor=0.667`, `correctRatio=0.8` → `isCorrect=false` → `streakAfter=0`, `comboMult=1`, `mult=2`.
- `contentBase=1360`; `speedBase=1700·0.5·0.667·0.8≈453`; tổng thô `1813`.
- `pointsEarned=round(1813·1·2)=3627`; `speedBonus=round(453·2)=907`. (Chấm từng phần + Boss x2, nhưng combo mất vì chưa đúng hoàn toàn.)

**VD-C — Boss MCQ, đúng, chuỗi bão hoà.** `basePoints=1500`, `durationMs=30000`, `remainingMs=24000`→`speedFactor=0.8`, `correctRatio=1`, `streakBefore=5`→`streakAfter=6`→`comboMult=1+min(0.6,0.5)=1.5`, `mult=2`.
- `contentBase=1500`; `speedBase=1500·0.5·0.8=600`; tổng thô `2100`.
- `pointsEarned=round(2100·1.5·2)=6300`; `speedBonus=round(600·1.5·2)=1800`. (Kịch trần một câu Boss.)

**VD-D — `truefalse` đúng 3/4.** `basePoints=1000`, `speedFactor=0.5`, `correctRatio=0.75` → `isCorrect=false`, `streakAfter=0`, `mult=1`.
- `contentBase=750`; `speedBase=1000·0.5·0.5·0.75=187.5`; `pointsEarned=round(937.5)=938`; `speedBonus=188`.

**VD-E — Không trả lời / sai hoàn toàn.** `correctRatio=0` → `contentBase=0`, `speedBase=0` → `pointsEarned=0`, `speedBonus=0`, `streakAfter=0`.

---

## C.3. Cập nhật STREAK (chuỗi combo)

Áp **một lần tại REVEAL**, theo thứ tự nộp không quan trọng (mỗi người 1 câu/lượt):

```
applyStreak(player, gradeResult):
  if passStreak(gradeResult.correctRatio):     # mặc định: đúng hoàn toàn
      player.streak += 1
  else:                                        # sai / một phần / KHÔNG trả lời
      player.streak = 0
```

- **Đúng liên tiếp** → `streak` tăng, `comboMult` tăng tới trần +50% (streak ≥ 5).
- **Sai, đúng một phần (< ngưỡng), hoặc bỏ lượt** → `streak` reset về 0.
- Người **không trả lời** cũng bị reset (xử lý ở C.7) — chuỗi phải "được duy trì" bằng hành động.
- `streak` sau cập nhật đi vào `yourResult.streak` và `leaderboardUpdate.players[].streak` (badge `🔥x{streak}`).

---

## C.4. Điểm đội & SHIP PROGRESS

### C.4.1. Điểm đội

```
teamScore(teamId) = Σ player.score  với player.teamId === teamId
```

Tính lại (hoặc cộng dồn) tại mỗi REVEAL. TeamName lấy từ cấu hình đội (Phần A `teamAssigned.teamName`).

### C.4.2. Ship progress (0..1) — bám `leaderboardUpdate.shipPositions`

Hải trình gồm `TOTAL_LEGS = 5` chặng (Trạm 1→4 + Boss), về **cảng đích** ở cuối. `stationsCleared` = số chặng lớp đã hoàn tất REVEAL (0..5), đồng bộ toàn lớp. Để tàu các đội **xếp theo điểm trong cùng chặng** mà không vượt cổng trạm kế:

```
maxTeamScore = max(teamScore of all teams)  (0 nếu chưa có điểm)
scoreLead(team) = maxTeamScore > 0 ? teamScore(team) / maxTeamScore : 0    # 0..1

progress(team) = clamp(
     stationsCleared / TOTAL_LEGS
   + (scoreLead(team) * INTRA_LEG) / TOTAL_LEGS ,
   0, 1)

stationReached(team) = legToStationId(stationsCleared)
   # 0->1 (đang ở cửa Trạm 1), 1->2, 2->3, 3->4, 4->"boss", 5->"boss" (đã tới cảng)
```

- Đội dẫn đầu: `scoreLead=1` → nhô thêm `INTRA_LEG/TOTAL_LEGS = 0.6/5 = 0.12` trong chặng; đội theo sau ít hơn theo điểm. Không đội nào vượt cổng chặng kế (vì `INTRA_LEG < 1`).
- Khi Boss xong (`stationsCleared=5`) → `progress = 1.0` cho mọi đội (đều cập cảng), đội dẫn đầu đã tới trước → khớp `VICTORY`.
- **Phương án đơn giản (dự phòng):** bỏ phần điểm, `progress = stationsCleared / TOTAL_LEGS` cho mọi đội (tàu đi cùng nhịp, chỉ phân biệt bằng hạng ở bảng). Dùng nếu muốn "đua tri thức" thuần theo trạm.

> `StationId` map 6 ⇄ `"boss"` được `questionStore` chuẩn hoá; `stationReached` luôn phát ra dạng `1|2|3|4|"boss"` đúng kiểu hợp đồng.

---

## C.5. LEADERBOARD — xếp hạng kép & payload

### C.5.1. Xếp hạng cá nhân

Sắp giảm dần theo tie-break (đảm bảo tất định):

```
sort players by:
  1) score            DESC
  2) streak           DESC     # cùng điểm, ai chuỗi dài hơn trên
  3) answeredTotalMs  ASC      # ai nhanh hơn tổng thể trên
  4) joinSeq          ASC      # ổn định cuối cùng
```

Gán `rank` theo **standard competition ranking** (1,2,2,4): cùng khoá sắp xếp thì cùng hạng.

### C.5.2. Xếp hạng đội

```
sort teams by teamScore DESC, (tie: điểm cá nhân cao nhất DESC, rồi teamId ASC)
rank tương tự (1,2,2,4)
```

### C.5.3. Build & phát `leaderboardUpdate`

```ts
function buildLeaderboard(): LeaderboardPayload {
  const players = rankPlayers()                          // đã sort + rank
    .slice(0, LEADERBOARD_PLAYER_CAP)                     // giảm băng thông
    .map(p => ({ playerId:p.playerId, nickname:p.nickname,
                 teamId:p.teamId, score:p.score, streak:p.streak, rank:p.rank }));
  const teams = rankTeams()
    .map(t => ({ teamId:t.teamId, teamName:t.teamName, score:t.score, rank:t.rank }));
  const shipPositions = teams.map(t => ({
    teamId: t.teamId,
    progress: progress(t.teamId),                         // C.4.2, 0..1
    stationReached: stationReached(t.teamId)              // StationId
  }));
  return { players, teams, shipPositions };
}
```

Phát ở phase `LEADERBOARD`/`BOSS_REVEAL→LEADERBOARD`. Màn chiếu dùng `teams` + `shipPositions`; console/điện thoại dùng thêm `players`. (FE giữ snapshot hạng trước để animate FLIP/lật kèo — server chỉ gửi trạng thái hiện tại.)

---

## C.6. PHÂN TÍCH FORMATIVE (console giáo viên)

Tích luỹ theo từng câu ngay khi chấm (REVEAL), lưu để tổng hợp theo topic/trạm.

### C.6.1. Số liệu mỗi câu

Mẫu số chuẩn: `answeredCount` = số **submission hợp lệ** (nộp trước deadline) của câu đó.

```
classCorrectPct = answeredCount>0 ? round(100 * correctFull / answeredCount) : 0
   # correctFull = số người có isCorrect === true (đúng hoàn toàn)
```

> `classCorrectPct` tính trên **người có trả lời**. Song song, `answerLocked` cung cấp `answeredCount`/`totalPlayers` để giáo viên biết tỉ lệ tham gia. (Tunable: đổi mẫu số sang `totalPlayers` nếu muốn "cả lớp" gồm cả người bỏ lượt.)

Theo type (đi vào `answerRevealed.stats`):

- **mcq / selectwrong** — `optionPct[optId] = round(100 * chọn(optId) / answeredCount)` cho mọi option (tổng ~100%).
- **truefalse** — `statementCorrectPct[stId] = round(100 * (số người chọn ĐÚNG isTrue của st) / answeredCount)`.
- **dragdrop / matching** — `bucketCorrectPct[itemId] = round(100 * (số người đặt item vào ĐÚNG correctBucket) / answeredCount)`. **Khoá theo `itemId`** (để FE "tô từng itemId" ở màn Reveal — mục 6 Phần A).

### C.6.2. Payload `answerRevealed` (khớp Phần A dòng 495–519)

```ts
answerRevealed = {
  questionId, type,
  correct: {                                  // lộ đáp án ĐÚNG TẠI ĐÂY (quy tắc #1)
    optionId?,      // mcq
    wrongOptionId?, // selectwrong (= q.correct, phương án SAI)
    statements?,    // truefalse: {stId: isTrue}
    placement?      // dragdrop/matching: {itemId: correctBucket}
  },
  stats: { optionPct?, statementCorrectPct?, bucketCorrectPct?, classCorrectPct },
  yourResult?: { isCorrect, pointsEarned, speedBonus, streak }   // gửi RIÊNG người đã trả lời
}
```

### C.6.3. Tổng hợp theo topic / trạm (bảng formative của console)

```
foreach question đã reveal:
   group by station (1..4, "boss") và group by topic ("5.1.1","5.1.2","5.1.3","5.2","NOXH")
   aggregate:
      avgClassCorrectPct(group) = trung bình classCorrectPct các câu trong nhóm
      misconceptionFlag = classCorrectPct < MISCONCEPTION_THRESHOLD (60%)
      ngộ_nhận = option/statement SAI có optionPct/tỉ-lệ-chọn cao nhất
                 (mcq: option != correct có optionPct max; selectwrong: option != wrongOptionId
                  bị chọn nhiều nhất; truefalse: statement có statementCorrectPct thấp nhất)
```

Cấu trúc phục vụ `FormativeTable` / `MisconceptionFlag` (mỗi dòng = 1 câu: `stationName`, `topic`, `learningLevel`, thanh `classCorrectPct`, ô "ngộ nhận"). Server có thể phát qua một event host-only (vd `formativeUpdate`) hoặc để console tự cộng dồn từ chuỗi `answerRevealed` — MVP: **console cộng dồn client-side** từ `answerRevealed.stats`, server chỉ giữ số liệu thô để xuất cuối buổi.

---

## C.7. Xử lý biên (edge cases)

| Tình huống | Xử lý server |
|---|---|
| **Không trả lời** (không có submission) | 0 điểm câu đó; **streak reset về 0** tại REVEAL; KHÔNG gửi `yourResult` (chỉ gửi cho người đã trả lời — Phần A); không tính vào `answeredCount`. |
| **Trả lời sau deadline** | `serverReceivedAt > deadlineTs` → **LOẠI**. Ack `{ok:true, received:false, error:"LATE"}`; không ghi vào `submissions` để chấm; không tính vào `answeredCount`. (Dùng `serverReceivedAt` của server làm chuẩn, KHÔNG tin `clientSentAt`.) |
| **Idempotent (reconnect gửi lại)** | Khoá theo `(questionId, playerId)`. **Lần hợp lệ ĐẦU TIÊN trước deadline thắng** (first-write-wins, quy tắc #3). Lần sau: ack `{ok:true, received:true}` nhưng **không** ghi đè, không chấm lại → không cộng điểm 2 lần. |
| **Payload lệch type / thiếu khoá / rác** | `grade()` trả `correctRatio:0` (item thiếu = sai); vẫn ghi nhận là "đã nộp" (vào `answeredCount`) nhưng 0 điểm, streak reset. |
| **Reconnect giữa câu** | `rejoin` → phát lại `roomState` + `timerSync({deadlineTs})` (client tự resume đếm ngược theo mốc tuyệt đối); nếu đã có submission → báo trạng thái đã-nộp (client hiện `SubmittedOverlay`). Không cho nộp lại (first-write-wins). |
| **Reveal chạy 2 lần** (host bấm lại / replay) | Guard `QuestionRuntime.graded`: chấm & cộng điểm **đúng một lần**, các lần sau **replay** từ `computed` cache (điểm/stereak không đổi). |
| **Auto-lock vs host lock** | `LOCKED` có thể do server (setTimeout tới `deadlineTs`) hoặc host `lockAnswers`. Cả hai đóng băng `submissions`; submission tới sau mốc `deadlineTs` vẫn bị loại theo `serverReceivedAt` dù setTimeout chưa kịp chạy. |
| **Boss không có `pointsMultiplier`** | `questionMultiplier = q.pointsMultiplier ?? (station===6 ? 2 : 1)` — an toàn kể cả dữ liệu thiếu. |
| **`answeredCount = 0`** (cả lớp bỏ lượt) | Mọi `*Pct` = 0 (tránh chia 0); `answerRevealed` vẫn phát đáp án đúng để lớp học. |

---

### Tóm tắt tham chiếu hợp đồng đã tuân thủ

- Đáp án chỉ lộ ở `answerRevealed`; `stationOpened`/`PublicQuestion` đã lược `correct/isTrue/correctBucket` (quy tắc #1).
- Tốc độ chấm bằng `deadlineTs` tuyệt đối + `serverReceivedAt` của server; tự khoá khi hết giờ (quy tắc #2).
- `submitAnswer` idempotent theo `questionId`, first-valid-wins (quy tắc #3).
- Toàn bộ chấm đúng + tính điểm ở server (quy tắc #4).
- Map `station:6 ⇄ "boss"` xuyên suốt grading/analytics/leaderboard; Boss `pointsMultiplier=2`.
- Payload khớp đúng field: `answerLocked{answeredCount,totalPlayers}`, `answerRevealed{correct,stats,yourResult}`, `leaderboardUpdate{players,teams,shipPositions}`, `bossPhase{pointsMultiplier}`.

---

## D. Question Service & Điều phối luồng chơi

> **Owner:** Backend Lead · **Module:** `src/server/services/QuestionService.ts` + phối hợp `RoomEngine` · **Ngày:** 2026-07-09
> Phần này đặc tả module **nạp / kiểm định / phục vụ câu hỏi** và **điều phối trình tự trạm → boss** theo hợp đồng Socket.io ở **Phần A** (FE spec). Mọi tên `event / phase / mode / type / field` dùng ở đây **trích nguyên** từ Phần A — không đổi tên, không thêm event ngoài danh sách.
>
> **3 luật bất di bất dịch phải giữ trong toàn module:**
> 1. Payload gửi PLAYER (`stationOpened.question` kiểu `PublicQuestion`) **KHÔNG chứa** `correct` / `isTrue` / `correctBucket`.
> 2. Đáp án đúng chỉ ra qua `answerRevealed`; `explain` + thẻ tri thức chỉ ra qua `knowledgeCard` (sau reveal).
> 3. Đồng hồ đồng bộ bằng `deadlineTs` (epoch ms tuyệt đối); server tự khóa khi hết giờ.

---

### D.0. Ranh giới trách nhiệm (đọc trước)

`QuestionService` là **nguồn chân lý về câu hỏi + đáp án** phía server. Nó **thuần dữ liệu, không giữ state phòng, không phát socket**. Việc phát event và chuyển `phase` do `RoomEngine` đảm nhiệm; việc quy đổi ra điểm (tốc độ + combo + boss ×2) do `ScoringService` đảm nhiệm.

| Việc | Ai làm |
|---|---|
| Nạp + validate `questions.json`, giữ bản đầy đủ **CÓ đáp án** | **QuestionService** |
| Ánh xạ `station 6 ↔ "boss"` | **QuestionService** |
| `buildPublicQuestion` (lược đáp án), xáo trộn thứ tự | **QuestionService** |
| Chọn câu theo trạm/mode, trình tự trạm, hạ số trạm | **QuestionService** (host điều nhịp) |
| **Chấm 1 bài** → đúng/sai + phần đúng (`GradeResult`) | **QuestionService** (`grade`) — nó giữ đáp án |
| Dựng `answerRevealed.correct` + `stats` | **QuestionService** (`getCorrectPayload`, `computeStats`) |
| Quy `GradeResult` → `pointsEarned` (tốc độ, combo/streak, ×2 boss) | **ScoringService** |
| Giữ `roomState.phase`, đặt `deadlineTs`, timer auto-lock, phát mọi event | **RoomEngine** |
| Chống trùng `submitAnswer` (idempotent theo `questionId`), giữ "lần hợp lệ đầu tiên trước deadline" | **RoomEngine / SubmissionStore** |

> Nguyên tắc "**client KHÔNG tự chấm**" (Phần A) được bảo đảm vì mọi hàm chấm nằm trong `QuestionService`, gọi từ server; đáp án không rời server trước `answerRevealed`.

---

### D.1. Mô hình dữ liệu nội bộ

`questions.json` (bản **CÓ đáp án**, chỉ tồn tại phía server). Kiểu nội bộ `FullQuestion` **giữ nguyên** cấu trúc file, kể cả `station: 6` cho boss:

```ts
// CHỈ phía server — KHÔNG BAO GIỜ gửi nguyên bản này cho client
type RawStation = 1 | 2 | 3 | 4 | 6;          // 6 = boss trong file JSON

interface FullQuestion {
  id: string;                      // = questionId (vd "t1-q1", "boss-q3")
  station: RawStation;             // 1..4 | 6
  stationName: string;
  type: QuestionType;              // mcq|selectwrong|truefalse|dragdrop|matching
  topic: string;
  learningLevel: string;           // "nho"|"hieu"|"phan_loai"|"van_dung"
  difficulty: 1 | 2 | 3;
  timeLimitSec: number;
  basePoints: number;
  prompt: string;
  pointsMultiplier?: number;       // CHỈ boss (=2)
  // ── theo type — CÓ đáp án ──
  options?:    { id: string; text: string }[];                    // mcq, selectwrong
  correct?:    string;                                            // mcq: id ĐÚNG; selectwrong: id SAI cần chọn
  statements?: { id: string; text: string; isTrue: boolean }[];   // truefalse
  buckets?:    { id: string; name: string }[];                    // dragdrop, matching
  items?:      { id: string; text: string; correctBucket: string }[]; // dragdrop, matching
  // ── phụ trợ ──
  explain: string;
  knowledgeCard: string;           // LƯU Ý: file là STRING; event cần OBJECT → xem D.9
  commonMistake: string;           // giữ server-side, KHÔNG có trong hợp đồng event
}
```

**Ánh xạ trạm bắt buộc** (StationId của hợp đồng là `1|2|3|4|"boss"`):

```ts
const toPublicStation = (s: RawStation): StationId => (s === 6 ? "boss" : s);
const toRawStation   = (s: StationId): RawStation => (s === "boss" ? 6 : s);
```

- Mọi payload ra client (`PublicQuestion.station`, `answerRevealed`… `knowledgeCard.station`) dùng `"boss"`.
- Mọi tra cứu nội bộ theo file dùng `6`. `getStationPool("boss")` = pool `station === 6`.

**Ngân hàng hiện tại (v1.0.0):** 40 câu — Trạm1=7, Trạm2=6, Trạm3=9, Trạm4=7, Boss(6)=11. Phân bố type: `mcq`×28, `selectwrong`×4, `truefalse`×3, `dragdrop`×2, `matching`×3. Đây là **kỳ vọng validate** ở D.2.

---

### D.2. Nạp & validate lúc khởi động

Gọi **một lần** khi server boot. Lỗi cấu trúc là **chặn khởi động** (fail-fast) để không bao giờ chạy buổi thật với ngân hàng hỏng; các bất thường nhẹ chỉ **cảnh báo**.

```ts
interface ValidationReport {
  ok: boolean;                                    // false ⇒ có errors ⇒ refuse boot
  errors:   { questionId?: string; field?: string; message: string }[];
  warnings: { questionId?: string; message: string }[];
  summary:  { total: number; perStation: Record<StationId, number> };
}
```

**Bảng luật kiểm định** (`error` = chặn boot, `warn` = cho chạy, log ra console + đưa vào `warnings`):

| Kiểm tra | Áp dụng | Mức |
|---|---|---|
| `id` tồn tại & **duy nhất** toàn ngân hàng | mọi câu | error |
| `station ∈ {1,2,3,4,6}` | mọi câu | error |
| `type ∈ QuestionType` | mọi câu | error |
| `timeLimitSec > 0`, `basePoints > 0`, `prompt` khác rỗng, có `explain`, có `knowledgeCard` | mọi câu | error |
| `options.length ≥ 2`, id option **unique**, **`correct ∈` id options** | `mcq`, `selectwrong` | error |
| `truefalse`: `statements.length ≥ 1`, mỗi statement có `isTrue` kiểu boolean, id unique | `truefalse` | error |
| `dragdrop`/`matching`: `buckets.length ≥ 2`, `items.length ≥ 1`, id bucket & id item unique, **mỗi `item.correctBucket ∈` id buckets** | `dragdrop`, `matching` | error |
| Boss (`station 6`) có `pointsMultiplier` (nên =2) | boss | warn (thiếu ⇒ mặc định 2) |
| `learningLevel ∈ {nho,hieu,phan_loai,van_dung}` | mọi câu | warn |
| Số câu mỗi trạm khác kỳ vọng (7/6/9/7/11) | tổng thể | warn |
| `selectwrong`: `prompt` nên chứa dấu hiệu "KHÔNG đúng / SAI" | `selectwrong` | warn |

- Sau khi validate, dựng **index**: `byId: Map<string, FullQuestion>` và `byStation: Map<StationId, FullQuestion[]>` (đã áp `toPublicStation`).
- `load()` **throw** nếu `report.ok === false` (in toàn bộ `errors`).

---

### D.3. `buildPublicQuestion` — lược bỏ đáp án

Chuyển `FullQuestion` → `PublicQuestion` (kiểu đúng như Phần A). **Bắt buộc lược**: `correct`, `statements[].isTrue`, `items[].correctBucket`, và **bỏ hẳn** `explain / knowledgeCard / commonMistake`. Giữ `options/statements/buckets/items` chỉ với `id` + `text/name`.

```ts
buildPublicQuestion(questionId: string, ctx: { roomCode: string; playerId?: string }): PublicQuestion;
```

| `type` | Giữ (chỉ `id`+`text/name`) | Lược bỏ |
|---|---|---|
| `mcq` | `options[{id,text}]` | `correct` |
| `selectwrong` | `options[{id,text}]` | `correct` (id phương án SAI) |
| `truefalse` | `statements[{id,text}]` | `isTrue` từng statement |
| `dragdrop` | `buckets[{id,name}]` + `items[{id,text}]` | `correctBucket` từng item |
| `matching` | `buckets[{id,name}]` (cột phải) + `items[{id,text}]` (cột trái) | `correctBucket` từng item |

Ánh xạ trường chung: `questionId=id`, `station=toPublicStation(station)`, giữ nguyên `stationName, type, topic, learningLevel, difficulty, timeLimitSec, basePoints, prompt`. `pointsMultiplier` **chỉ đính kèm khi là boss** (để FE hiện badge "×2"). Thứ tự `options`/`items`/`buckets` đã **xáo trộn** theo D.4.

> **Kiểm thử bắt buộc:** unit test khẳng định `JSON.stringify(publicQuestion)` **không** chứa các khóa `"correct"`, `"isTrue"`, `"correctBucket"`, `"explain"`, `"commonMistake"`. Đây là chốt chặn luật vàng #1.

---

### D.4. Xáo trộn (shuffle) chống "ngó bài"

Xáo **thứ tự** `options` (mcq/selectwrong) và thứ tự `items` + `buckets` (dragdrop/matching). Mục tiêu: phá kiểu chia sẻ "đáp án là ô thứ 2" / màn chiếu và điện thoại lệch layout.

**Cơ chế: hoán vị tất định theo seed** (deterministic, không cần lưu bảng ánh xạ trong RAM):

```ts
seed = hash(`${roomCode}:${playerId ?? "room"}:${questionId}`);   // PRNG gieo hạt (vd mulberry32)
```

- **Mặc định — xáo theo từng player** (`playerId` có mặt): mỗi máy một thứ tự ⇒ chống ngó bài mạnh nhất. Vì tất định, **reconnect tái tạo đúng thứ tự cũ** → UI không "nhảy", giữ trải nghiệm nhất quán.
- **Rút gọn — xáo theo phòng** (`playerId` vắng): mọi player cùng thứ tự, nhưng khác màn chiếu; dùng khi muốn đơn giản.
- **`id` được GIỮ NGUYÊN (canonical)**, chỉ đổi thứ tự phần tử. Vì `AnswerPayload` và `answerRevealed.correct` đều tham chiếu **theo `id`** (không theo vị trí), nên **chấm điểm không cần dịch ngược** — `getCorrectPayload` trả `id` gốc và FE tô đúng/sai theo `id` bất kể thứ tự.

> **Tùy chọn nâng cấp (relabel id):** nếu sau này muốn đổi cả nhãn hiển thị (vd A/B/C/D → khác nhau mỗi máy), **bắt buộc lưu/ tái tạo map `displayId → canonicalId`** từ cùng `seed` để dịch ngược khi chấm — đúng yêu cầu "lưu mapping để chấm đúng". Bản v1.0 dùng phương án xáo-thứ-tự (id canonical) để chấm không phụ thuộc ngữ cảnh.

---

### D.5. Trình tự trạm & chọn câu theo mode

**Trình tự trạm** (khớp vòng lặp state machine Phần A):

```
[1] → [2] → [3] → [4] → "boss"
```

```ts
getStationSequence(mode: GameMode): StationId[];      // mặc định [1,2,3,4,"boss"]
setStationSequence(stations: StationId[]): void;      // HẠ SỐ TRẠM khi thời gian gấp (vd [1,2,4,"boss"])
```

**Chọn câu trong 1 trạm** — pool mỗi trạm được **xáo một lần/phiên** rồi rút tuần tự **không trùng lặp**:

```ts
planStation(station: StationId, mode: GameMode): string[];   // trả danh sách questionId theo thứ tự sẽ hỏi
nextQuestionInStation(station: StationId): string | null;    // rút câu kế; null = hết kế hoạch trạm này
```

Số câu/ trạm suy ra từ `mode` (mode là **enum đơn** theo hợp đồng — xem D.6):

| mode | Câu/trạm thường (1..4) | Câu boss | Ghi chú |
|---|---|---|---|
| `lite` | **1** | 1–2 | Van tiết kiệm thời gian; có thể `setStationSequence` còn 3 trạm |
| `chuan` | **1–2** | 2–3 | Bản đầy đủ |
| `fallback` | **1** | 1 | Tối giản, chạy nhanh (xem D.6) |
| `no-projector` | 1–2 | 2–3 | Như `chuan` về số câu; chỉ khác ở render (D.6) |

- Pool cạn: nếu số câu yêu cầu > số câu còn trong pool ⇒ dừng ở số câu còn lại + `warn` (không lặp câu đã hỏi).
- `nextQuestionInStation` trả `null` ⇒ host chuyển sang `showLeaderboard()` rồi `nextStation()`.

---

### D.6. Điều phối MODE (`setMode`)

`mode: GameMode = "lite" | "chuan" | "fallback" | "no-projector"` là **cross-cutting, KHÔNG phải phase**. Host phát `setMode({mode})`; `RoomEngine` cập nhật `roomState.mode` và phát `modeChanged({mode, reason?})`. `QuestionService` đọc `mode` để suy `modeConfig`:

| mode | Số câu (D.5) | Hiệu ứng realtime | Chọn câu | Render bản đồ/xếp hạng |
|---|---|---|---|---|
| `lite` | 1 câu/trạm, cho phép ≤3–4 trạm | bình thường | như thường | máy chiếu |
| `chuan` | 1–2 câu/trạm | bình thường | như thường | máy chiếu |
| `fallback` | 1 câu/trạm | **bỏ animation nặng, tăng throttle** `leaderboardUpdate` (≈800ms), giảm `reactionBroadcast` | như thường, **vẫn cùng bộ event** | máy chiếu |
| `no-projector` | 1–2 câu/trạm | bình thường | như thường | **player tự render** từ `leaderboardUpdate` |

Điểm chốt tuân thủ hợp đồng:
- **`fallback` KHÔNG đổi tên/ bỏ event** — vẫn `stationOpened → timerSync → answerLocked → answerRevealed → knowledgeCard → leaderboardUpdate`; chỉ giảm tần suất/độ nặng. Có thể bật tự động khi `RoomEngine` phát hiện socket bất ổn (`reason:"network"`).
- **`no-projector` không đụng tới chọn câu**; server **vẫn phát đủ** `leaderboardUpdate` (gồm `shipPositions`) để PLAYER tự vẽ bản đồ. Không có màn `screen`.
- Vì `mode` là **một** giá trị, khi cần vừa "ít câu" vừa "không máy chiếu" thì host chọn mode trội theo tình huống; `QuestionService` luôn suy hành vi từ mode hiện hành (không giữ cờ chồng chéo).

---

### D.7. Xử lý BOSS (station 6 → `"boss"`)

- Pool boss = `getStationPool("boss")` (11 câu, `station===6`). Mọi câu có `pointsMultiplier: 2`.
- Vòng boss theo state machine: `startBoss` → **`BOSS_INTRO`** → `startAnswering` → **`BOSS_ANSWERING`** → (lock) → `revealAnswer` → **`BOSS_REVEAL`** → `showLeaderboard` → `LEADERBOARD` → `VICTORY`. **Boss KHÔNG có `STATION_OPEN`** (enum `stationOpened.phase` chỉ nhận `"STATION_OPEN"|"ANSWERING"|"BOSS_ANSWERING"`).
- `RoomEngine` phát **`bossPhase`** ở mỗi pha boss, giá trị từ:

```ts
getBossMeta(): { pointsMultiplier: number; title: string };
// → { pointsMultiplier: 2, title: "Cơn Bão Nhà Ở Xã Hội" }
```

  ⇒ `bossPhase({ phase: "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL", pointsMultiplier: 2, title: "Cơn Bão Nhà Ở Xã Hội" })`.
- `PublicQuestion` của câu boss **đính `pointsMultiplier: 2`** (FE hiện badge "×2" + màu `--color-boss`).
- Nhân ×2 **KHÔNG** làm ở `QuestionService`; `grade` chỉ trả đúng/sai. `ScoringService` đọc `pointsMultiplier` (từ `FullQuestion`/`getBossMeta`) để nhân điểm.

---

### D.8. Chấm khóa đáp án: `grade`, `getCorrectPayload`, `computeStats`

Đáp án đúng **chỉ rời server ở `REVEAL`/`BOSS_REVEAL`**. Ba hàm dưới cấp toàn bộ dữ liệu cho `answerRevealed` và cho `ScoringService`.

```ts
interface GradeResult {
  isCorrect: boolean;                    // đúng HOÀN TOÀN (correctRatio === 1)
  correctRatio: number;                  // 0..1 — dùng cho "chấm đúng từng phần"
  perPart?: Record<string, boolean>;     // statementId | itemId -> đúng?  (không có ở mcq/selectwrong)
}

grade(questionId: string, answer: AnswerPayload): GradeResult;
```

**Quy tắc chấm theo `type`:**

| `type` | `AnswerPayload` | Đúng khi | `correctRatio` |
|---|---|---|---|
| `mcq` | `{optionId}` | `optionId === correct` | 0 hoặc 1 |
| `selectwrong` | `{optionId}` | `optionId === correct` (id phương án **SAI**) | 0 hoặc 1 |
| `truefalse` | `{answers: Record<id,bool>}` | mọi `answers[id] === statement.isTrue` | (số statement đúng)/(tổng) |
| `dragdrop` | `{placement: Record<itemId,bucketId>}` | mọi `placement[i] === item.correctBucket` | (số item đúng)/(tổng) |
| `matching` | `{placement: Record<itemId,bucketId>}` | mọi `placement[i] === item.correctBucket` | (số item đúng)/(tổng) |

- `grade` **thuần & tất định** ⇒ chấm lại cùng đáp án luôn ra cùng kết quả (an toàn với reconnect). **Idempotency** ("không cộng điểm 2 lần", "lấy lần hợp lệ đầu tiên trước deadline") do `RoomEngine/SubmissionStore` lo — `QuestionService` không giữ submission.
- `correctRatio` là đầu vào "chấm đúng từng phần" của `ScoringService` (điểm nền ≈ `basePoints × correctRatio`, rồi cộng tốc độ + combo, nhân ×2 nếu boss). **Công thức điểm chi tiết thuộc `ScoringService`.**

**Dựng `answerRevealed.correct`** (đúng cấu trúc Phần A, id canonical — không phụ thuộc xáo trộn):

```ts
getCorrectPayload(questionId: string): {
  optionId?: string;                     // mcq
  wrongOptionId?: string;                // selectwrong
  statements?: Record<string, boolean>;  // truefalse: id -> isTrue
  placement?: Record<string, string>;    // dragdrop/matching: itemId -> correctBucket
};
```

| `type` | Nguồn (`FullQuestion`) | Trả về |
|---|---|---|
| `mcq` | `correct` | `{ optionId: correct }` |
| `selectwrong` | `correct` (id SAI) | `{ wrongOptionId: correct }` |
| `truefalse` | `statements[].isTrue` | `{ statements: { s1:false, s2:true, … } }` |
| `dragdrop`/`matching` | `items[].correctBucket` | `{ placement: { i1:"b1", … } }` |

**Dựng `answerRevealed.stats`** (tổng hợp trên các bài đã nộp):

```ts
computeStats(questionId: string, answers: { playerId: string; answer: AnswerPayload }[]): {
  optionPct?: Record<string, number>;           // mcq/selectwrong: % người chọn mỗi option
  statementCorrectPct?: Record<string, number>; // truefalse: % trả lời ĐÚNG mỗi statement
  bucketCorrectPct?: Record<string, number>;    // dragdrop/matching: % xếp ĐÚNG các item của bucket đó
  classCorrectPct: number;                        // % lớp trả lời ĐÚNG HOÀN TOÀN câu này
};
```

> `yourResult` (per-player: `isCorrect, pointsEarned, speedBonus, streak`) do `ScoringService` tạo và `RoomEngine` gửi **riêng từng socket** kèm `answerRevealed`; phần `correct` + `stats` là chung toàn phòng.

---

### D.9. Thẻ tri thức — thích ứng string → object

`questions.json` lưu `knowledgeCard` là **chuỗi**, nhưng event `knowledgeCard` của Phần A cần **object** `{title, body, badge?, station}`. `QuestionService` chuyển đổi:

```ts
buildKnowledgeCardPayload(questionId: string): {
  questionId: string;
  explain: string;                                     // = FullQuestion.explain
  knowledgeCard: { title: string; body: string; badge?: string; station: StationId };
};
```

Quy tắc dựng:
- `explain` ← `FullQuestion.explain` (nguyên văn).
- `knowledgeCard.body` ← `FullQuestion.knowledgeCard` (chuỗi gốc).
- `knowledgeCard.title` ← `stationName` (vd `"Đảo Khái Niệm"`; boss: `"Cơn Bão Nhà Ở Xã Hội"`).
- `knowledgeCard.station` ← `toPublicStation(station)` (`"boss"` cho boss).
- `knowledgeCard.badge` ← huy hiệu theo trạm (tùy chọn; boss ⇒ badge "×2").
- `commonMistake` **không** nằm trong hợp đồng event ⇒ **không phát** (giữ server-side; nếu muốn hiển thị có thể ghép vào cuối `explain`, **không** thêm field mới vào event).

---

### D.10. Vòng đời 1 câu hỏi — sơ đồ trình tự

Host điều nhịp bằng host-action; `RoomEngine` đổi `phase` + phát event; `QuestionService` cấp dữ liệu.

```
HOST action        RoomEngine (phase + emit)                         QuestionService cấp gì
─────────────────────────────────────────────────────────────────────────────────────────────
openStation({station})
  └─▶ phase = STATION_OPEN
      planStation(station, mode) → [qId,…]; qId = nextQuestionInStation(station)
      emit stationOpened({ question: buildPublicQuestion(qId, ctx), phase:"STATION_OPEN" })   ← ĐÃ lược đáp án
      (roomState.currentStation, currentQuestionId ← cập nhật)

startAnswering({questionId})
  └─▶ phase = ANSWERING   (boss ⇒ BOSS_ANSWERING)
      deadlineTs = serverNow + getTimeLimitSec(qId)*1000
      emit stationOpened({ question, phase:"ANSWERING"|"BOSS_ANSWERING" })
      emit timerSync({ questionId, deadlineTs, serverNow, durationSec })
      setTimeout(deadlineTs) ⇒ tự động LOCKED               ← luật vàng #2 (server auto-lock)
      [boss] emit bossPhase({ phase:"BOSS_ANSWERING", pointsMultiplier:2, title })

(player) submitAnswer(...)  → SubmissionStore: idempotent theo questionId; nhận nếu trước deadlineTs
      emit answerAck({ questionId, received, serverReceivedAt })   (do connection layer)

deadline hết  HOẶC  lockAnswers({questionId})
  └─▶ phase = LOCKED
      emit answerLocked({ questionId, answeredCount, totalPlayers })

revealAnswer({questionId})
  └─▶ phase = REVEAL   (boss ⇒ BOSS_REVEAL)
      với mỗi submission: grade(qId, answer) → ScoringService → pointsEarned/yourResult
      correct = getCorrectPayload(qId);  stats = computeStats(qId, submissions)
      emit answerRevealed({ questionId, type, correct, stats, yourResult(per-socket) })  ← đáp án ra ở ĐÂY
      [boss] emit bossPhase({ phase:"BOSS_REVEAL", … })

showKnowledgeCard({questionId})
  └─▶ phase = KNOWLEDGE_CARD
      emit knowledgeCard(buildKnowledgeCardPayload(qId))          ← explain + thẻ tri thức

showLeaderboard()
  └─▶ phase = LEADERBOARD
      emit leaderboardUpdate({ players, teams, shipPositions })   (ScoringService cấp số)

  ┌─ còn câu trong trạm (CHUẨN)? nextQuestionInStation(station) ≠ null ─▶ quay lại startAnswering
  └─ hết câu trạm ─▶ nextStation()  (còn trạm ⇒ openStation trạm kế;  hết 4 trạm ⇒ startBoss → BOSS_INTRO)
```

- `PAUSED` / `FALLBACK` là overlay/mode: `deadlineTs` **không tự reset**; khi thoát, `RoomEngine` phát lại `roomState` (+ `stationOpened`/`timerSync` nếu đang answering) theo `resumePhase`. `QuestionService` không giữ trạng thái phase nên không bị ảnh hưởng.

---

### D.11. API nội bộ `QuestionService`

```ts
class QuestionService {
  // ── D.2  Khởi tạo & kiểm định ──
  static load(jsonPath: string): QuestionService;          // throw nếu report.ok === false
  getValidationReport(): ValidationReport;

  // ── Tra cứu ──
  getById(questionId: string): FullQuestion | undefined;
  getStationPool(station: StationId): FullQuestion[];      // nhận 1|2|3|4|"boss"
  countByStation(): Record<StationId, number>;
  getTimeLimitSec(questionId: string): number;             // cho RoomEngine đặt deadlineTs

  // ── D.3 + D.4  Payload công khai (lược đáp án + xáo trộn) ──
  buildPublicQuestion(questionId: string, ctx: { roomCode: string; playerId?: string }): PublicQuestion;

  // ── D.5  Điều phối trạm / chọn câu ──
  getStationSequence(mode: GameMode): StationId[];         // [1,2,3,4,"boss"]
  setStationSequence(stations: StationId[]): void;         // hạ số trạm khi gấp
  planStation(station: StationId, mode: GameMode): string[];
  nextQuestionInStation(station: StationId): string | null;

  // ── D.7  Boss ──
  isBoss(station: StationId): boolean;                     // station === "boss"
  getBossMeta(): { pointsMultiplier: number; title: string };

  // ── D.8  Chấm (giữ đáp án) ──
  grade(questionId: string, answer: AnswerPayload): GradeResult;
  getCorrectPayload(questionId: string): RevealCorrect;     // = answerRevealed.correct
  computeStats(questionId: string,
               answers: { playerId: string; answer: AnswerPayload }[]): RevealStats; // = answerRevealed.stats

  // ── D.9  Thẻ tri thức ──
  buildKnowledgeCardPayload(questionId: string): KnowledgeCardEvent;
}
```

`RevealCorrect`, `RevealStats`, `KnowledgeCardEvent` khớp **nguyên** payload `answerRevealed.correct`, `answerRevealed.stats`, `knowledgeCard` ở Phần A §5.3.

---

### D.12. Checklist tuân thủ hợp đồng (Definition of Done)

- [ ] `buildPublicQuestion` không rò `correct` / `isTrue` / `correctBucket` / `explain` / `commonMistake` (có unit test khẳng định).
- [ ] `station: 6` ánh xạ `"boss"` ở **mọi** payload; tra cứu nội bộ dùng `6`.
- [ ] `load()` fail-fast khi có `error`; in đủ `errors`; đếm đúng 40 câu (7/6/9/7/11).
- [ ] Xáo trộn tất định theo `seed` ⇒ reconnect tái tạo đúng thứ tự; id canonical ⇒ chấm không lệ thuộc xáo trộn.
- [ ] `getCorrectPayload` trả đúng khóa theo `type` (`optionId`/`wrongOptionId`/`statements`/`placement`).
- [ ] `grade` chấm **đúng từng phần** cho `truefalse`/`dragdrop`/`matching` (`correctRatio`, `perPart`).
- [ ] Boss: `PublicQuestion.pointsMultiplier=2`, `bossPhase` phát đúng 3 pha; nhân ×2 do `ScoringService`.
- [ ] `setMode` chỉ đổi hành vi (số câu/throttle/render), **không** đổi tên hay bỏ event nào; `fallback` giữ nguyên chuỗi event.
- [ ] `knowledgeCard` string → object (`title/body/badge?/station`) đúng hợp đồng.
- [ ] `QuestionService` **không** phát socket, **không** giữ phase/submission (ranh giới D.0).

---

**Phụ thuộc & tham chiếu:** hợp đồng Socket.io + state machine ở **Phần A** (FE spec) · dữ liệu gốc `mini-game/server/data/questions.json` · điều phối `phase`/timer/idempotency thuộc `RoomEngine` · công thức điểm (tốc độ + combo/streak + ×2 boss) thuộc `ScoringService`.

---

I have everything I need: the FE Part A contract, the plan (incl. section 6.6), README, and the exact `questions.json` shape (`{meta, questions[]}`, each item keyed by `id` like `t1-q1`/`boss-q1`, `station` uses `6` for boss, `basePoints` 1000 / boss 1500, `knowledgeCard`/`explain` are strings, `learningLevel:"nho"`, etc.). Below is section E, returned verbatim.

---

## E. Bảo mật, Chống gian lận, HTTP, Kiểm thử & Vận hành

> Phần này là **giao kèo vận hành phía Backend**. Mọi tên event / field / code ở đây **bám đúng Hợp đồng Socket.io (FE Phần A, mục 5)** — không đổi tên, không thêm event ngoài danh sách. Ba luật **bất di bất dịch** của hợp đồng được thực thi ở tầng server tại đây: (1) payload gửi PLAYER đã lược đáp án; (2) đáp án/thống kê chỉ đến qua `answerRevealed`, `explain`/`knowledgeCard` chỉ đến qua `knowledgeCard` sau reveal; (3) timer đồng bộ bằng `deadlineTs` tuyệt đối, server tự khóa khi hết giờ; (4) client không tự chấm — mọi chấm điểm ở server.

### E.0. Quy ước ánh xạ dữ liệu (nhắc lại — dùng xuyên suốt phần này)

Server đọc `server/data/questions.json` (`{ meta, questions[] }`, bản **đầy đủ có đáp án**) rồi ánh xạ sang hợp đồng:

| questions.json | Hợp đồng (Phần A) | Ghi chú |
|---|---|---|
| `id` (vd `"t1-q1"`, `"boss-q1"`) | `questionId` | Khóa định danh câu — dùng làm khóa idempotent & khóa audit |
| `station: 1..4` \| `6` | `StationId: 1..4` \| `"boss"` | **BE PHẢI map `6 ↔ "boss"`** ở mọi payload ra/vào |
| `correct` / `isTrue` / `correctBucket` | — | **Bị lược** khỏi `PublicQuestion`; chỉ dùng nội bộ để chấm & trả qua `answerRevealed` |
| `explain` (string), `knowledgeCard` (string) | `knowledgeCard.explain`, `knowledgeCard.knowledgeCard.body` | BE dựng object `{title, body, badge?, station}`: `title`=`stationName` (hoặc tiêu đề rút gọn), `body`=chuỗi `knowledgeCard`, `station`=StationId đã map. Chỉ gửi **sau** REVEAL |
| `pointsMultiplier` (chỉ Boss, =2) | `PublicQuestion.pointsMultiplier` | Được phép gửi trước (không lộ đáp án); dùng để hiển thị badge x2 |

Ngân hàng: **40 câu** — Trạm1=7, Trạm2=6, Trạm3=9, Trạm4=7, Boss(station 6)=11. `basePoints`=1000 (Boss 1500), `timeLimitSec` 20–30s.

---

### E.1. Bảo mật (Security)

#### E.1.1. Sinh `roomCode` (6 ký tự)

- Bảng chữ **không nhập nhằng** (bỏ `0/O`, `1/I/L`) để đọc từ QR/đọc miệng không sai: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (32 ký tự → `32^6 ≈ 1,07 tỷ` tổ hợp).
- Sinh bằng **CSPRNG** (`crypto.randomInt`), **kiểm trùng** với các phòng đang sống, trùng thì sinh lại (tối đa N lần). In hoa toàn bộ; chuẩn hóa input người dùng về in hoa + trim khi join.

```ts
import { randomInt } from "node:crypto";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function genRoomCode(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}
// tại nơi tạo phòng: lặp genRoomCode() cho tới khi !rooms.has(code)
```

#### E.1.2. Sinh `hostToken` bí mật (chỉ host giữ)

- Token ngẫu nhiên **≥ 256-bit**: `crypto.randomBytes(32).toString("base64url")`. Sinh **1 lần/phòng**, trả **duy nhất** trong response `POST /rooms` (mục E.3.2). Server lưu bản gốc trong `room.hostToken`; **không bao giờ** phát lại qua bất kỳ event nào (không có trong `roomState`, `playerList`, …).
- URL host (`/host?room=CODE`) **không nhúng** token trong query để tránh lộ qua lịch sử/log proxy; host dán token vào ô nhập (hoặc lưu `sessionStorage`). Token truyền lên khi mở socket qua **handshake auth**, không phải trong payload `joinRoom` (giữ nguyên chữ ký hợp đồng).

#### E.1.3. Xác thực **mọi** host action

Hợp đồng `joinRoom({roomCode, role, reconnectToken?})` **không có** field token → token đi kèm ở **handshake** `socket.handshake.auth.hostToken`. Khi `joinRoom` với `role:"host"`, server so **timing-safe** với `room.hostToken`; sai → `errorEvent{code:"NOT_HOST", fatal:true}` + `disconnect`. Đúng → gắn cờ `socket.data.isHost = true`. Mỗi handler host (`startGame, openStation, startAnswering, lockAnswers, revealAnswer, showKnowledgeCard, showLeaderboard, nextStation, startBoss, pauseGame, resumeGame, setMode, endGame`) đi qua guard `requireHost`.

```ts
import { timingSafeEqual } from "node:crypto";
function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function requireHost(socket, room): boolean {
  if (socket.data.isHost && socket.data.roomCode === room.code) return true;
  socket.emit("errorEvent", { code: "NOT_HOST", message: "Cần host token hợp lệ", fatal: false });
  return false;   // handler dừng, KHÔNG thực hiện transition
}
```

> Player **không bao giờ** kích hoạt transition. Nếu một socket không-host phát event host → `NOT_HOST` (không fatal, chỉ bỏ qua) để tránh disconnect nhầm do bug client.

#### E.1.4. CORS chỉ cho domain game

- Áp cho **cả HTTP (Express/Fastify) lẫn Socket.io**. Danh sách origin lấy từ ENV `ALLOWED_ORIGINS` (CSV). Từ chối origin lạ ngay tầng handshake.

```ts
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
const io = new Server(httpServer, {
  cors: { origin: ORIGINS, methods: ["GET", "POST"], credentials: false },
});
app.use(cors({ origin: ORIGINS }));   // Express tương ứng
```

- Vì FE build được **phục vụ cùng process/cùng domain** (mục E.7), request thực tế là same-origin; `ALLOWED_ORIGINS` chủ yếu để chặn socket từ domain khác nhúng chéo. Không dùng `origin:"*"` ở production.

#### E.1.5. Ép HTTPS / WSS

- Server thường **đứng sau reverse proxy** (Caddy/Nginx — kế hoạch mục 6.6) lo TLS; app bật `trust proxy` để đọc đúng `X-Forwarded-Proto`/IP thật. Nếu request tới bằng `http` → **redirect 308** sang `https`. Site HTTPS ⇒ Socket.io tự chạy `wss://`; **không** hard-code `ws://` ở bất kỳ đâu.
- Proxy **bắt buộc** chuyển tiếp `Upgrade`/`Connection` cho đường `/socket.io` (mục E.7 & kế hoạch 6.6). Nếu sau Cloudflare: **bật WebSocket**, **không cache** `/socket.io/*`.
- Đặt security header cơ bản (Helmet): `HSTS`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` (màn chiếu/host không cho nhúng iframe chéo).

#### E.1.6. Cấu hình qua ENV — không commit secret

- **Không** commit `hostToken`, không secret trong repo. Chỉ commit `.env.example` (khóa rỗng). File `.env` nằm trong `.gitignore` (đã có ở `mini-game/.gitignore`). Xem bảng ENV đầy đủ ở mục E.7.3.

---

### E.2. Chống gian lận (Anti-cheat — toàn bộ ở server)

| # | Biện pháp | Cách thực thi (server) |
|---|---|---|
| 1 | **Đáp án chỉ ở server** | `PublicQuestion` build bằng hàm `toPublic(q)` **whitelist field** (không dùng `delete` trên bản gốc). Không có `correct/isTrue/correctBucket/explain/knowledgeCard/commonMistake` trong `stationOpened`. Có **integration test** khẳng định các field này vắng mặt (E.6.2). |
| 2 | **Xáo trộn đáp án** | Xáo **thứ tự** `options`/`statements`/`items`/`buckets` **theo từng player** (giữ nguyên `id` để `submitAnswer` vẫn khớp). Vì thứ tự khác nhau mỗi máy → "ngó bài" hàng xóm vô nghĩa; vì `id` bất biến → không lộ đáp án. Do đó `stationOpened` **emit per-socket** (30 socket — chi phí không đáng kể), không broadcast chung. |
| 3 | **Idempotent 1 lần/câu, chỉ trước deadline** | Khóa idempotent = `(questionId, playerId)` — **playerId ổn định qua reconnect** (không dùng `socket.id`). Lần hợp lệ **đầu tiên trước `deadlineTs`** được giữ; lần sau trả `ack{ok:true, received:true}` + `errorEvent{code:"DUP_SUBMIT"}` nhưng **không chấm lại/không cộng điểm lần 2**. |
| 4 | **Timer theo server** | `deadlineTs = serverNow + timeLimitSec*1000` chốt tại lúc `startAnswering`; đẩy qua `timerSync`. Server đặt `setTimeout` tự chuyển `ANSWERING→LOCKED` (mục hợp đồng #2). `submitAnswer` sau `deadlineTs` (theo đồng hồ **server**, kèm biên độ trễ mạng nhỏ ~250ms) → `errorEvent{code:"DEADLINE_PASSED"}`, không tính. `clientSentAt` **chỉ tham khảo**, không tin tuyệt đối. |
| 5 | **Validate & sanitize mọi input** | Mọi payload C→S qua schema (Zod hoặc guard thủ công): đúng shape theo `type`, đủ field, `teamId ∈ 1..6`, `questionId` là chuỗi & khớp `currentQuestionId`, giới hạn kích thước (vd `placement` không quá số item, `answers` không quá số statement). Sai → `errorEvent{code:"INVALID_PAYLOAD"}` + drop. |
| 6 | **Escape nickname chống XSS** | `setNickname`: trim, chuẩn hóa Unicode NFC, chặn ký tự điều khiển/zero-width, **escape HTML** (`& < > " '`), giới hạn **2–20 ký tự hiển thị**. Lưu bản đã sạch; FE vẫn escape lần nữa khi render (phòng thủ theo lớp). |
| 7 | **Bộ lọc từ cấm nickname** | Danh sách chặn (tiếng Việt có dấu/không dấu + leetspeak + tiếng Anh) nạp từ file cấu hình; match sau khi bỏ dấu/khoảng trắng. Vi phạm → `errorEvent{code:"NICKNAME_REJECTED"}`, yêu cầu đổi (không disconnect). |
| 8 | **Rate-limit `sendReaction`** | Token-bucket per-socket (vd **≤ 5 reaction/giây, burst 10**). Vượt → **drop im lặng** (hoặc `errorEvent{code:"RATE_LIMITED"}` throttle log). `reactionBroadcast` phát bằng `volatile` (mất gói lúc nghẽn cũng không sao). Áp rate-limit nhẹ cả cho `joinRoom`/`submitAnswer`/`setNickname` chống spam. |
| 9 | **1 nickname / 1 session token** | `joinRoom` cấp `reconnectToken` (CSPRNG) ↔ 1 `playerId`. Một session token chỉ gắn **một** player/nickname; mở tab mới = session mới = player mới (không "nhân bản" điểm). Tùy chọn: chặn trùng nickname trong phòng (thêm hậu tố `#2` hoặc `NICKNAME_TAKEN`). Host có thể kick (đóng socket + vô hiệu token). |

> **Ranh giới chấm điểm/lộ đáp án:** `answerRevealed` mới mang `correct` + `stats` (+`yourResult` **per-socket** cho người đã trả lời); `knowledgeCard` mới mang `explain`+`knowledgeCard`. Không handler nào được phát hai event này trước khi phase là `REVEAL`/`BOSS_REVEAL` (reveal) và `KNOWLEDGE_CARD`. Guard bằng kiểm `room.phase` trong `revealAnswer`/`showKnowledgeCard`.

---

### E.3. HTTP Endpoints (Express/Fastify)

Chạy **chung 1 process** với Socket.io (cùng `httpServer`). FE build tĩnh cũng do process này phục vụ ⇒ **1 URL, 1 domain**.

#### E.3.1. `GET /health`
Trả nhanh cho reverse proxy / uptime check / pre-warm đầu giờ (chống "server ngủ" — rủi ro kế hoạch mục 10):
```json
{ "ok": true, "uptimeSec": 1234, "rooms": 2, "connections": 37, "version": "1.0.0" }
```
`200` luôn khi process sống; không chạm state nặng, không auth.

#### E.3.2. `POST /rooms` — tạo phòng
Body (tùy chọn): `{ mode?: "lite"|"chuan", hostName? }`. Xử lý: sinh `roomCode` (E.1.1) + `hostToken` (E.1.2), khởi tạo `room` in-memory ở phase `LOBBY`, nạp bộ câu hỏi. Trả:
```json
{
  "roomCode": "K7M4PQ",
  "hostToken": "Vb3...base64url...",          // TRẢ DUY NHẤT 1 LẦN
  "hostUrl":    "https://game.example.edu/host?room=K7M4PQ",
  "playerUrl":  "https://game.example.edu/play?room=K7M4PQ",
  "presentUrl": "https://game.example.edu/present?room=K7M4PQ",
  "qrDataUrl":  "data:image/png;base64,iVBOR..."   // QR trỏ playerUrl
}
```
- `hostToken` **không** ghi vào log (mục E.4). Base URL lấy từ ENV `PUBLIC_BASE_URL`.
- Có thể **rate-limit theo IP** (vd ≤ 30 phòng/giờ) và/hoặc chắn bằng `CREATE_ROOM_KEY` (ENV) nếu muốn hạn chế ai được tạo phòng.

#### E.3.3. Sinh QR
Dùng lib `qrcode` sinh **data URL** (không phụ thuộc dịch vụ ngoài, chạy offline được):
```ts
import QRCode from "qrcode";
const qrDataUrl = await QRCode.toDataURL(playerUrl, { margin: 1, width: 512, errorCorrectionLevel: "M" });
```
QR trỏ `playerUrl` (kèm `?room=CODE`) để SV quét là vào thẳng `/play` đúng phòng. Màn chiếu (`/present`) cũng có thể render lại QR từ chuỗi này.

#### E.3.4. `GET /present?room=…`, `GET /host?room=…`, `GET /play?room=…` — phục vụ SPA
Cả 3 route trả **cùng `index.html`** của FE build (SPA client-side routing tự nhận `/present|/host|/play`). Cấu hình **SPA fallback**: mọi path không phải `/api`, `/socket.io`, `/health`, hay file tĩnh → trả `index.html`.
```ts
app.use(express.static(CLIENT_DIST, { index: false, maxAge: "1h", immutable: true }));
app.get(/^\/(?!api|socket\.io|health|rooms).*/, (_req, res) => res.sendFile(join(CLIENT_DIST, "index.html")));
```
Không nhúng `hostToken` vào HTML; host tự nhập/paste token phía client (E.1.2).

#### E.3.5. (Tùy chọn) `GET /rooms/:code/report` — xuất kết quả sau buổi
Kết xuất từ audit/state cuối phiên: bảng điểm cá nhân + đội, mức hiểu theo chủ đề, `classCorrectPct` từng câu.
- `?format=json` (mặc định) hoặc `?format=csv` (`Content-Type: text/csv; charset=utf-8`, có BOM để Excel đọc tiếng Việt).
- **Bảo vệ**: chỉ mở khi kèm `hostToken` hợp lệ của phòng (query `?token=` hoặc header `Authorization: Bearer …`); không token → `403`. Vì state in-memory, endpoint chỉ dùng được **khi phòng còn sống** (hoặc khi bật lưu snapshot cuối phiên — xem E.5 & kế hoạch 6.5: SQLite tùy chọn nếu cần báo cáo lâu dài).
- CSV cột gợi ý: `playerId,nickname,teamId,teamName,score,streakMax,correctCount,answeredCount,rank`.

---

### E.4. Log & Audit

**Structured logging** (khuyến nghị `pino`, JSON, `LOG_LEVEL` qua ENV). Mỗi bản ghi kèm `ts, roomCode, phase`. Ghi các sự kiện then chốt để ra soát & dựng `report`:

| Sự kiện log | Trường chính | Mục đích |
|---|---|---|
| `room.create` | roomCode, mode | Vòng đời phòng (**không log hostToken**) |
| `player.join` / `player.rejoin` | playerId, nickname(đã sạch), teamId, connected | Theo dõi vào/ra, reconnect |
| `phase.transition` | from→to, byHost/bySystem, currentQuestionId | Kiểm tra đúng máy trạng thái |
| `answer.submit` | playerId, questionId, received, latencyMs, dup? | Ra soát idempotent & tốc độ |
| `answer.reveal` | questionId, classCorrectPct | Mức hiểu của lớp theo câu/chủ đề |
| `score.award` | playerId, questionId, isCorrect, pointsEarned, speedBonus, streak, multiplier | Truy vết điểm (đối chiếu khiếu nại) |
| `host.action` | action, socketId | Audit thao tác điều phối |
| `error` | code, message, socketId | Gỡ lỗi vận hành |

> Không log payload nhạy cảm/không cần thiết; **tuyệt đối không log `hostToken`, `reconnectToken` đầy đủ** (nếu cần, chỉ log 4 ký tự cuối). Có thể ghi ra file xoay vòng (pino + logrotate/PM2) để trích `report` cuối buổi.

#### Bảng mã `errorEvent` (chuẩn — client bắt theo `code`)

| `code` | Khi nào phát | `fatal` | Hành động server |
|---|---|---|---|
| `ROOM_NOT_FOUND` | `joinRoom`/`rejoin` với roomCode không tồn tại | `true` | disconnect |
| `NOT_HOST` | host event nhưng socket không có host token hợp lệ | `true` (socket tự nhận host) / `false` (player lỡ tay) | deny/disconnect |
| `BAD_PHASE` | action không hợp lệ ở phase hiện tại (vd `submitAnswer` khi chưa `ANSWERING`; host gọi sai thứ tự vòng lặp trạm) | `false` | bỏ qua transition |
| `DUP_SUBMIT` | `submitAnswer` lần ≥2 cho `(questionId, playerId)` | `false` | giữ lần đầu; ack `received:true` |
| `DEADLINE_PASSED` | `submitAnswer` sau `deadlineTs` (giờ server) | `false` | không tính điểm |
| `RATE_LIMITED` | vượt ngưỡng `sendReaction`/submit/join | `false` | drop |
| `INVALID_PAYLOAD` | schema sai/thiếu field/quá lớn | `false` | drop |
| `QUESTION_NOT_FOUND` | `questionId` không khớp `currentQuestionId` | `false` | drop |
| `NICKNAME_REJECTED` | nickname rỗng/quá dài/chứa từ cấm | `false` | yêu cầu đổi |
| `NOT_JOINED` | phát event game trước khi `joinRoom` thành công | `false` | drop |
| `ROOM_FULL` | vượt trần người chơi (vd `MAX_PLAYERS`) | `true` | deny |
| `INVALID_TEAM` | `chooseTeam` với `teamId ∉ 1..6` | `false` | drop |

---

### E.5. Hiệu năng & Đồng thời (~30 người)

- **Throttle broadcast leaderboard**: `leaderboardUpdate` gộp và phát tối đa **1 lần / 200–500ms** (trailing throttle) thay vì mỗi lần điểm đổi. Tính lại xếp hạng + `shipPositions` một lần rồi phát chung.
- **Payload nhỏ**: chỉ gửi field cần; làm tròn `score`; `topPlayers` giới hạn (vd top 10); `progress` 2 chữ số thập phân. `stationOpened` per-socket nhưng gọn (đã lược đáp án).
- **`answerRevealed`**: phần `correct`+`stats` giống nhau → tính 1 lần; chỉ `yourResult` khác nhau nên emit per-socket (ghép `{...base, yourResult}` cho từng player đã trả lời; người chưa trả lời nhận base không kèm `yourResult`).
- **Reaction**: dùng `socket.volatile.emit` để rớt gói khi nghẽn thay vì dồn hàng đợi.
- **1 instance là đủ**: toàn bộ state in-memory trong 1 process; ~30 (thực tế chịu 100–200) kết nối/phòng không cần Redis, không cần message broker. `setTimeout` cho deadline chạy ngay trong process.
- **Khi nào mới cần Redis adapter + sticky session**: chỉ khi **scale ngang nhiều instance** (nhiều phòng lớn chia tải qua ≥2 process/nhiều máy) hoặc cần HA. Lúc đó thêm `@socket.io/redis-adapter` để broadcast xuyên instance **và** bật **sticky session** ở proxy (IP-hash/cookie) để 1 client luôn về đúng instance (state in-memory không tự chia sẻ). Với quy mô 1 lớp/1 buổi ⇒ **không cần** (đúng kế hoạch mục 6.1). Nếu sau này cần bền dữ liệu để `report` ⇒ SQLite/Postgres tùy chọn (kế hoạch 6.5), không đổi kiến trúc realtime.

---

### E.6. Kiểm thử (Testing)

#### E.6.1. Unit test — chấm điểm & tính điểm (`vitest`/`jest`)
Tách **hàm thuần** `grade(question, answer)` và `score({basePoints, correctness, remainingMs, durationMs, streakBefore, multiplier})` để test không cần socket.

Ca kiểm bắt buộc theo từng `type`:
- **mcq**: chọn `correct` → đúng (điểm đầy đủ); chọn khác → 0 điểm, streak reset.
- **selectwrong**: `correct` = id **phương án SAI** → chọn đúng id đó = đúng; chọn phương án đúng (không phải SAI) = sai.
- **truefalse**: `answers[stmtId]` khớp `isTrue` từng câu → **chấm từng phần** (đúng k/n statement → điểm theo tỷ lệ); toàn đúng = full; toàn sai = 0.
- **dragdrop**: `placement[itemId] === correctBucket` từng item → chấm từng phần; đủ item đúng = full.
- **matching**: như dragdrop (`itemId(trái) → bucketId(phải)`), chấm từng cặp.
- **Thưởng tốc độ**: `remainingMs = durationMs` (trả lời tức thì) → speedBonus tối đa (~+50%); `remainingMs → 0` (sát deadline) → speedBonus ≈ 0. Kiểm tính đơn điệu theo thời gian còn lại.
- **Combo/streak**: chuỗi đúng liên tiếp tăng hệ số (x1.1 → **trần x1.5**); một câu sai reset về 1.
- **Boss**: `pointsMultiplier = 2` nhân vào tổng (đúng + tốc độ + combo).
- **Biên**: submit sau deadline → không điểm; submit trùng `(questionId, playerId)` → chỉ tính **một** lần; payload sai type → `INVALID_PAYLOAD`, không crash.

`pointsEarned`/`speedBonus`/`streak` trả về phải **khớp field trong `answerRevealed.yourResult`**.

#### E.6.2. Integration test — luồng 1 câu (server thật + `socket.io-client`)
Khởi động server trên cổng ngẫu nhiên, nối 1 host + vài player, chạy đúng vòng hợp đồng:
`joinRoom` → `chooseTeam` → host `openStation` → `startAnswering` → nhận `timerSync` (có `deadlineTs`) → `submitAnswer` (nhận `ack{received:true}` + `answerAck`) → `lockAnswers` (nhận `answerLocked{answeredCount,totalPlayers}`) → `revealAnswer` (nhận `answerRevealed` có `correct`+`stats.classCorrectPct`+`yourResult`) → assert điểm.

Assertion **bảo mật bắt buộc**: bắt payload `stationOpened.question` và khẳng định **không có** `correct` / `isTrue` / `correctBucket` / `explain` / `knowledgeCard`. Assert `submitAnswer` sau `deadlineTs` bị từ chối; submit lần 2 không cộng điểm (`DUP_SUBMIT`). Assert map `station 6 ↔ "boss"` đúng trong pha Boss.

#### E.6.3. Load test — 30–40 client mô phỏng
Bắt buộc trước buổi thật (kế hoạch mục 8/10). Hai lựa chọn:
- **`socket.io-client` script** (`scripts/loadtest.mjs`): spawn 30–40 client, mỗi client `joinRoom` → `chooseTeam` → chờ `stationOpened`/`timerSync` → `submitAnswer` với độ trễ ngẫu nhiên trong `timeLimitSec`; đo **p50/p95 latency** của `ack`, tỉ lệ rớt, RAM process.
- **Artillery** với `artillery-engine-socketio-v3`: kịch bản `join → wait → emit submitAnswer → think`, ramp 40 arrivals.

Ngưỡng đạt (tham khảo, mạng LAN/local): p95 ack **< 150ms**, **0** kết nối rớt, RAM ổn định (không rò), broadcast `leaderboardUpdate` giữ nhịp throttle. Chạy kèm **dry-run trên chính wifi lớp** (kế hoạch 6.6-C).

---

### E.7. Vận hành (Operations)

#### E.7.1. npm scripts (`server/package.json`)
```jsonc
{
  "scripts": {
    "dev":       "tsx watch src/index.ts",
    "build":     "tsc -p tsconfig.json",
    "start":     "node dist/index.js",          // production (PM2 gọi lệnh này)
    "typecheck": "tsc --noEmit",
    "lint":      "eslint .",
    "test":      "vitest run",
    "test:watch":"vitest",
    "loadtest":  "node scripts/loadtest.mjs"
  }
}
```
Backend cũng **serve FE build**: trong bước build tổng, chạy `cd client && npm ci && npm run build` rồi trỏ `CLIENT_DIST` vào `client/dist` (mục E.3.4).

#### E.7.2. PM2 (`server/ecosystem.config.cjs`)
State **in-memory** ⇒ chạy **1 instance, KHÔNG cluster** (nhiều instance sẽ chia rẽ state — xem E.5).
```js
module.exports = {
  apps: [{
    name: "mln-game",
    script: "dist/index.js",
    instances: 1,               // KHÔNG dùng "max"/cluster
    exec_mode: "fork",
    max_memory_restart: "400M",
    env: { NODE_ENV: "production", PORT: 3000 }
  }]
};
```
Lệnh: `pm2 start ecosystem.config.cjs` → `pm2 save` → `pm2 startup` (tự chạy lại sau reboot). Log: `pm2 logs mln-game`.

#### E.7.3. Biến môi trường (`.env.example` — commit bản rỗng)

| Biến | Ví dụ | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng nội bộ process nghe (proxy trỏ vào) |
| `NODE_ENV` | `production` | Bật tối ưu/ tắt stack trace chi tiết |
| `PUBLIC_BASE_URL` | `https://game.example.edu` | Dựng `hostUrl/playerUrl/presentUrl` + nội dung QR |
| `ALLOWED_ORIGINS` | `https://game.example.edu` | CORS/Socket.io origin cho phép (CSV) |
| `TRUST_PROXY` | `1` | Tin `X-Forwarded-*` từ Caddy/Nginx |
| `CLIENT_DIST` | `../client/dist` | Thư mục FE build để serve |
| `QUESTIONS_PATH` | `./data/questions.json` | Đường dẫn ngân hàng câu hỏi |
| `MAX_PLAYERS` | `60` | Trần người/phòng (an toàn cho lớp ~30) |
| `SUBMIT_GRACE_MS` | `250` | Biên độ trễ mạng cho phép quanh deadline |
| `REACTION_RATE` | `5` | Trần reaction/giây/socket |
| `LB_THROTTLE_MS` | `300` | Nhịp throttle broadcast leaderboard (200–500) |
| `LOG_LEVEL` | `info` | Mức log pino |
| `CREATE_ROOM_KEY` | `(tuỳ chọn)` | Khóa chặn `POST /rooms` nếu muốn |

`.env` **không commit** (đã có trong `.gitignore`). `hostToken` **không** đặt trong ENV — sinh runtime/phòng.

#### E.7.4. Deploy lên server & domain sẵn có
Bám **Mục 6.6** của kế hoạch (đã có VPS + domain):
1. **Server**: Node LTS + PM2; `git clone`/`rsync` mã; `cd client && npm ci && npm run build`; `cd server && npm ci && npm run build`; `pm2 start ecosystem.config.cjs`. Backend nghe `:3000` và **phục vụ luôn** FE build ⇒ **1 tiến trình, 1 URL**.
2. **Reverse proxy + HTTPS**: **Caddy** (khuyến nghị, tự Let's Encrypt) hoặc **Nginx + Certbot** trỏ domain → `:3000`. **Bắt buộc** chuyển tiếp `Upgrade`/`Connection` cho `wss://`.
   - *Caddyfile:* `game.example.edu { reverse_proxy localhost:3000 }` (Caddy tự lo WebSocket + TLS).
   - *Nginx:* trong `location /` thêm `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` (đặc biệt cho `/socket.io/`), `proxy_set_header X-Forwarded-Proto $scheme;`.
3. **DNS**: bản ghi `A` (+`AAAA` nếu có IPv6) → IP server. Nếu qua **Cloudflare proxy**: **bật WebSocket**, **không cache** `/socket.io/*`.
4. **Pre-warm** 5–10′ trước buổi (ping `/health`) để tránh trễ đầu giờ.

#### E.7.5. Checklist sẵn sàng chạy thật
- [ ] `npm run typecheck` + `npm run test` (unit + integration) **xanh**; test bảo mật "stationOpened không lộ đáp án" pass.
- [ ] `npm run loadtest` 30–40 client đạt ngưỡng p95/không rớt (E.6.3) + **dry-run trên wifi lớp**.
- [ ] `.env` production đủ biến (E.7.3); `ALLOWED_ORIGINS`/`PUBLIC_BASE_URL` đúng domain thật; **không có secret trong git**.
- [ ] HTTPS hợp lệ; kiểm `wss://` thật sự kết nối (không rơi về long-polling ngoài ý muốn); `/socket.io` không bị cache.
- [ ] `GET /health` trả `200`; PM2 `save` + `startup` đã cấu hình (tự sống lại sau reboot).
- [ ] `POST /rooms` trả `roomCode` + `hostToken` + QR data URL; QR quét ra đúng `/play?room=…`.
- [ ] Giảng viên đã **duyệt 100%** `questions.json` (đáp án + `explain`); map `station 6 ↔ "boss"` chạy đúng ở pha Boss (x2).
- [ ] Đã thử **reconnect giữa `ANSWERING`**: rejoin khôi phục `roomState`+`stationOpened`+`timerSync`, **giữ điểm**, submit lại không nhân đôi điểm.
- [ ] Host giữ `hostToken` riêng; thử một socket không token gọi host event → `NOT_HOST` (không phá phòng).
- [ ] Bật `report` (nếu dùng): xuất CSV/JSON có BOM đọc được tiếng Việt, có bảo vệ bằng `hostToken`.
- [ ] Kịch bản LITE/CHUẨN (`setMode`) + PAUSED/FALLBACK/`no-projector` đã thử chuyển & quay lại `resumePhase`.

---

*Ghi chú tham chiếu: mọi tên event/field trong phần E lấy từ Hợp đồng Socket.io (FE Phần A, mục 5) và ánh xạ dữ liệu ở E.0; phần deploy bám Kế hoạch mục 6.6; ngân hàng câu hỏi tại `mini-game/server/data/questions.json` (40 câu, `id`→`questionId`, `station:6`→`"boss"`).*
