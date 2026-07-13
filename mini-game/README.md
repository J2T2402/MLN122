# Hành Trình Định Hướng — Mini Game ôn tập Chương 5

Mã nguồn mini game web realtime ôn tập **KTTT định hướng XHCN** (Kinh tế chính trị Mác–Lênin, Chương 5).
Xem kế hoạch tổng thể: [`../Document/ke-hoach-mini-game.md`](../Document/ke-hoach-mini-game.md).

## Cấu trúc thư mục

```
mini-game/
├── README.md              ← file này
├── .gitignore
├── client/                ← Frontend: React + Vite + TypeScript + Tailwind (giao diện sinh viên, màn chiếu, console GV)
├── server/                ← Backend: Node.js + Socket.io (realtime, chấm điểm server-side, giữ state trong RAM)
│   └── data/
│       └── questions.json ← Ngân hàng câu hỏi 5 trạm + Boss (giảng viên DUYỆT trước khi chạy)
└── docs/                  ← Ghi chú kỹ thuật, sơ đồ, checklist ngày chạy
```

## Ngăn xếp công nghệ (theo kế hoạch)
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + Framer Motion (bản đồ đua tàu).
- **Backend:** Node.js + Socket.io (1 server duy nhất, state in-memory, **không cần database**).
- **Dữ liệu:** câu hỏi để trong `server/data/questions.json` — sửa trực tiếp, không đụng code.

## Bắt đầu (khi có code)
> Hiện thư mục mới là **khung chứa code + dữ liệu seed**. Khi dựng ứng dụng, quy trình dự kiến:
```bash
# Backend
cd server && npm install && npm run dev
# Frontend
cd client && npm install && npm run dev
```

## Triển khai lên server & domain sẵn có
Đã có server + domain riêng → xem checklist deploy tại **Mục 6.6** trong file kế hoạch:
cài Node + PM2, dựng Caddy/Nginx cho HTTPS, và lưu ý **WebSocket phải chạy `wss://`**.

## Cấu trúc 1 câu hỏi trong `questions.json` (cho người dựng engine)
Engine đọc theo trường `type`; **đáp án đúng nằm ngay trong dữ liệu** (không cần trường answerKey riêng):
| type | Trường dữ liệu | Đáp án đúng đọc ở đâu |
|---|---|---|
| `mcq`, `selectwrong` | `options[{id,text}]` | `correct` = id của option đúng (selectwrong: id của phương án SAI cần chọn) |
| `truefalse` | `statements[{id,text,isTrue}]` | `isTrue` của từng nhận định |
| `dragdrop`, `matching` | `buckets[{id,name}]` + `items[{id,text,correctBucket}]` | `correctBucket` = id nhóm đúng của mỗi item |
Mọi câu đều có: `station, stationName, topic, learningLevel, difficulty, timeLimitSec, basePoints, prompt, explain, knowledgeCard, commonMistake`. Câu Boss (station 6) có thêm `pointsMultiplier`.

## Tài liệu
- 📄 [`../Document/ke-hoach-mini-game.md`](../Document/ke-hoach-mini-game.md) — Kế hoạch tổng thể (BA plan).
- 📄 [`docs/fe-spec.md`](docs/fe-spec.md) — **Đặc tả Frontend đầy đủ** (design tokens, state machine, hợp đồng Socket.io, 16 màn người chơi + màn chiếu + console giáo viên + thư viện component).
- 📄 [`docs/be-spec.md`](docs/be-spec.md) — **Đặc tả Backend đầy đủ** (kiến trúc + mô hình dữ liệu in-memory, handler Socket.io & state machine, engine chấm điểm/chấm đúng, question service, bảo mật/chống gian lận/HTTP/kiểm thử/vận hành). Khớp đúng hợp đồng FE.
- 📄 [`docs/danh-sach-cau-hoi-dap-an.md`](docs/danh-sach-cau-hoi-dap-an.md) — Bảng câu hỏi + đáp án để soát nội dung.

## Trạng thái
- [x] Tạo khung thư mục
- [x] **Soạn ngân hàng câu hỏi v1.0.0 — 40 câu bám giáo trình, đã qua thẩm định đối chiếu** (T1:7, T2:6, T3:9, T4:7, Boss:11)
- [x] **Viết FE spec v1.0** ([docs/fe-spec.md](docs/fe-spec.md))
- [x] **Viết BE spec v1.0** ([docs/be-spec.md](docs/be-spec.md))
- [x] **Hiện thực hóa BE** ([server/](server/)) — Node + Socket.io + TS, state in-memory, chấm điểm server-side. Đã boot + pass load test end-to-end (host + 3 player → chơi → chấm → leaderboard → kết thúc); xác minh chống rò đáp án + công thức điểm đúng spec.
- [ ] Hiện thực hóa FE (theo [docs/fe-spec.md](docs/fe-spec.md))
- [ ] Giảng viên duyệt lại nội dung & đáp án trước khi chạy thật
- [ ] Load test 30–40 client + dry-run + deploy

### Chạy server
```bash
cd server && npm install && npm run dev   # http://localhost:3000
# tạo phòng: POST /api/create-room  ·  health: GET /healthz
# smoke test: npx ts-node --transpile-only src/scratch/loadTest.ts
```
