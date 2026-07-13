# FE SPECIFICATION — "Hành Trình Định Hướng: Vượt 5 Trạm Tri Thức"

> **Tài liệu hướng dẫn Lập trình viên Giao diện (Frontend).**
> Mini game web ôn tập Kinh tế chính trị Mác - Lênin, Chương 5. Stack: React + Vite + TypeScript + TailwindCSS + Framer Motion + socket.io-client.
> **Phiên bản:** 1.0 · **Ngày:** 2026-07-09
>
> Đọc kèm: kế hoạch tổng thể [`../../Document/ke-hoach-mini-game.md`](../../Document/ke-hoach-mini-game.md) · dữ liệu câu hỏi [`../server/data/questions.json`](../server/data/questions.json).

## Cách đọc tài liệu này
1. **Phần A — NỀN TẢNG** là *nguồn chân lý*: design tokens, state machine, hợp đồng Socket.io. Đọc trước tiên; mọi phần sau tham chiếu nó.
2. **Phần B/C/D** đặc tả 3 giao diện: Người chơi (điện thoại) · Màn chiếu · Console giáo viên.
3. **Phần E** là thư viện component + tương tác/animation/âm thanh/responsive/accessibility/edge-case dùng chung.

> ⚠️ Quy tắc vàng: **payload gửi cho người chơi đã lược bỏ đáp án đúng**; client không tự chấm. Timer đồng bộ theo **mốc deadline tuyệt đối từ server**.

---

# PHẦN A — NỀN TẢNG (Foundation)

## NỀN TẢNG — "Hành Trình Định Hướng: Vượt 5 Trạm Tri Thức"

> **Tài liệu nguồn chân lý (Single Source of Truth) cho toàn team FE.**
> Mọi spec khác (component, màn hình, animation, test) PHẢI tham chiếu tên **token / event / state** định nghĩa ở đây. Tên đã chốt — không đổi, không tự đặt biến thể.
> Phiên bản: `v1.0` · Owner: Lead FE/Design System · Cập nhật: 2026-07-09

---

## 0. Bối cảnh kỹ thuật (đọc trước khi code)

| Hạng mục | Chốt |
|---|---|
| Stack | React 18 + Vite + TypeScript (strict) + TailwindCSS + Framer Motion + `socket.io-client` v4 |
| Server | Giữ state trong RAM (in-memory room store), **chấm điểm server-side** |
| 3 giao diện | **1 codebase, 3 route/app**: PLAYER, BIG SCREEN, TEACHER CONSOLE |
| Đối tượng | ~30 SV/lớp, chơi trên **trình duyệt** điện thoại/laptop, **không cài app** |
| Điều phối | Giáo viên (host) **đồng bộ theo chặng**: mở/khóa trạm, chốt đáp án, tạm dừng |
| Nguyên tắc bảo mật vàng | **Payload gửi PLAYER đã LƯỢC BỎ đáp án đúng.** Đáp án + `explain` + `knowledgeCard` chỉ gửi **sau `answerRevealed`**. Client KHÔNG tự chấm. |
| Nguyên tắc thời gian vàng | Timer đồng bộ bằng **mốc deadline tuyệt đối (epoch ms) từ server**, không đếm ngược phía client độc lập. |

---

## 1. Nguyên tắc thiết kế (Design Principles)

### 1.1. PLAYER — Mobile-first, ngón cái (thumb-first)
- Thiết kế cho **màn dọc 360–430px**. Mọi hành động nằm trong **vùng ngón cái**: nút hành động chính neo đáy (`bottom action bar`), cao **≥ 56px** (touch target tối thiểu **44×44px** theo WCAG).
- **Một việc mỗi màn**: đang trả lời thì chỉ thấy câu hỏi + lựa chọn. Không nhồi leaderboard vào lúc đang làm.
- Phản hồi tức thì khi chạm (`:active` scale 0.97, haptic-style micro-animation ≤ 150ms). Trạng thái "đã gửi" phải rõ ràng: **đã khóa lựa chọn** + spinner chờ `answerAck`.
- Chịu lỗi hiển thị được: banner mạng yếu, tự reconnect, giữ điểm. Không bao giờ mất tiến trình khi F5.
- Chất Gen Z: emoji reaction, khoảnh khắc "lật kèo", huy hiệu theo trạm — nhưng **không cản trở** thao tác trả lời.

### 1.2. BIG SCREEN — TV-first, đọc từ xa (10-foot UI)
- Thiết kế cho **1920×1080, xem cách 5–8m**. **Cỡ chữ thân nhỏ nhất 24px**, tiêu đề **48–96px**, điểm số **≥ 96px**.
- **Tương phản cao** (nền tối biển đêm + chữ sáng, ratio ≥ **7:1**). Không dùng chữ mảnh (weight ≥ 600 cho nội dung lớn).
- **Không tương tác** — chỉ trình chiếu. Mọi chuyển cảnh do host điều khiển, nhận qua socket.
- Ưu tiên **bản đồ hải trình + 6 con tàu + leaderboard đội**. Câu hỏi hiện to; **KHÔNG hiện lựa chọn chi tiết nếu chỉ cần đọc từ xa** (player đọc chi tiết trên điện thoại).
- Animation "sóng biển", tàu tiến, kho báu mở — **thời lượng vừa đủ (0.6–1.2s)**, không gây chóng mặt (tôn trọng `prefers-reduced-motion`).

### 1.3. TEACHER CONSOLE — Dày control, kiểm soát tuyệt đối
- **Desktop/laptop ngang**. Mật độ thông tin cao: trạng thái phòng, số người đã trả lời (live), nút điều phối lớn, không nhầm lẫn.
- **Mọi nút quan trọng có xác nhận nếu bất khả hồi** (Reveal, End Game). Nút chính theo dòng chảy: `Mở trạm → Khóa → Chốt đáp án → Thẻ tri thức → Xếp hạng → Trạm kế`.
- Luôn hiển thị **"đang ở state nào"**, deadline còn lại, chế độ (mode) hiện tại, số kết nối.
- Panel khẩn cấp: `Tạm dừng`, `Chuyển FALLBACK`, `Chế độ không máy chiếu`.

### 1.4. Tông màu & ngôn ngữ hình ảnh chung (cả 3 app)
- Chủ đề **biển & hải trình**: xanh đại dương (primary), vàng kho báu (accent), la bàn/bản đồ/hải đăng/sóng.
- **Đúng = xanh lá**, **Sai = đỏ**, mỗi đội một màu cố định (mục 3.2).
- Cảng đích: **"Dân giàu – Nước mạnh – Dân chủ – Công bằng – Văn minh"** — luôn là đích cuối bản đồ.

---

## 2. Kiến trúc thông tin — 3 route/app trên 1 codebase

### 2.1. Routing (React Router)

| Route | App | Thiết bị | Vai trò socket (`role`) | Khi nào render |
|---|---|---|---|---|
| `/play` (mặc định, hoặc `/`) | **PLAYER** | Điện thoại (mobile-first) | `"player"` | Sinh viên quét QR / nhập mã phòng để chơi |
| `/present` | **BIG SCREEN** | TV/máy chiếu (TV-first) | `"screen"` | Máy chiếu lớp mở, tự join phòng ở chế độ chỉ-xem |
| `/host` | **TEACHER CONSOLE** | Laptop giáo viên | `"host"` | Giáo viên điều phối (có xác thực host token) |

- **Join phòng qua query**: `/play?room=ABCD`, `/present?room=ABCD`, `/host?room=ABCD`.
- **1 codebase**: chia theo `src/apps/player`, `src/apps/screen`, `src/apps/host`; dùng chung `src/shared` (socket client, types, tokens, state machine, question renderers).
- **Không dùng chung layout**: mỗi app có `RootLayout` riêng (mobile / TV / dashboard) nhưng **dùng chung design tokens** (mục 3).
- **Lazy-load theo app**: mỗi route `React.lazy` để bundle player nhẹ nhất (SV tải trên mạng di động).
- **Nguồn phase duy nhất**: cả 3 app đọc cùng một `roomState.phase` từ server → render nhánh UI tương ứng (mục 4).

```
src/
├─ apps/
│  ├─ player/    → route /play    (role: "player")
│  ├─ screen/    → route /present (role: "screen")
│  └─ host/      → route /host    (role: "host")
├─ shared/
│  ├─ socket/    (client, event types — HỢP ĐỒNG mục 5)
│  ├─ tokens/    (design tokens — mục 3)
│  ├─ machine/   (game state machine — mục 4)
│  ├─ questions/ (renderer theo 'type' — mục 6)
│  └─ types/     (Question, Answer, Leaderboard…)
```

---

## 3. Design Tokens (giá trị thực — DỨT KHOÁT)

> Đây là **nguồn token**. Tailwind config map trực tiếp từ các biến này. Component KHÔNG hardcode màu/px — chỉ dùng token.

### 3.1. Bảng màu — hệ thống (semantic + brand)

| Token | Giá trị (HEX) | Dùng cho |
|---|---|---|
| `--color-primary-900` | `#071A2F` | Nền biển đêm (dark bg) |
| `--color-primary-800` | `#0A2540` | Surface tối |
| `--color-primary-700` | `#0E4C7A` | Đường viền / hover đậm |
| `--color-primary-600` | `#1273C0` | **Primary chính** (nút, link, tàu) |
| `--color-primary-500` | `#2E90D9` | Primary sáng |
| `--color-primary-300` | `#5AA9E6` | Nhấn nhẹ |
| `--color-primary-100` | `#D6ECFB` | Nền primary rất nhạt |
| `--color-accent-600` | `#E0A200` | Vàng kho báu đậm |
| `--color-accent-500` | `#FFB800` | **Accent chính** (kho báu, combo, huy hiệu) |
| `--color-accent-300` | `#FFD666` | Ánh vàng nhạt / glow |
| `--color-success` | `#16A34A` | **ĐÚNG** (green) |
| `--color-success-bg` | `#DCFCE7` | Nền đáp án đúng (light) |
| `--color-danger` | `#DC2626` | **SAI** (red) |
| `--color-danger-bg` | `#FEE2E2` | Nền đáp án sai (light) |
| `--color-warning` | `#F59E0B` | Cảnh báo / mạng yếu / sắp hết giờ |
| `--color-info` | `#0EA5E9` | Thông báo trung tính |
| `--color-boss` | `#7C1D6F` | Trận BOSS (bão NOXH) — tím bão x2 |
| `--color-neutral-900` | `#0F172A` | Chữ chính (light mode) |
| `--color-neutral-600` | `#475569` | Chữ phụ |
| `--color-neutral-300` | `#CBD5E1` | Viền |
| `--color-neutral-100` | `#F1F5F9` | Nền nhạt |
| `--color-bg-light` | `#F0F6FC` | **Nền sáng** (biển nhạt) |
| `--color-surface-light`| `#FFFFFF` | Card sáng |
| `--color-bg-dark` | `#071A2F` | **Nền tối** (biển đêm — mặc định BIG SCREEN) |
| `--color-surface-dark` | `#0E2A47` | Card tối |
| `--color-text-on-dark` | `#E8F2FB` | Chữ trên nền tối |

### 3.2. Màu 6 đội (cố định — không hoán đổi)

| Đội | Token | HEX | Tên hiển thị |
|---|---|---|---|
| Đội 1 | `--team-1` | `#E11D48` | Hồng San Hô |
| Đội 2 | `--team-2` | `#F97316` | Cam Hải Đăng |
| Đội 3 | `--team-3` | `#FACC15` | Vàng Cánh Buồm |
| Đội 4 | `--team-4` | `#22C55E` | Lục Rong Biển |
| Đội 5 | `--team-5` | `#06B6D4` | Lam Sóng Bạc |
| Đội 6 | `--team-6` | `#A855F7` | Tím Hải Vương |

> 6 màu chọn để **phân biệt cả khi mù màu & nhìn từ xa** (hue cách đều). `teamId` (mục 5) = `1..6` map trực tiếp `--team-{n}`.

### 3.3. Typography

- `--font-display`: `"Baloo 2", "Be Vietnam Pro", system-ui, sans-serif` — tiêu đề, điểm số, BIG SCREEN.
- `--font-body`: `"Be Vietnam Pro", system-ui, -apple-system, sans-serif` — thân, UI (hỗ trợ tiếng Việt đầy đủ).
- `--font-mono`: `"JetBrains Mono", ui-monospace, monospace` — mã phòng (room PIN), số đếm.

**Type scale** (base 16px = 1rem). PLAYER dùng `xs–4xl`; BIG SCREEN dùng `2xl–9xl`.

| Token | px | rem | Dùng cho |
|---|---|---|---|
| `--text-xs` | 12 | 0.75 | Nhãn phụ, caption |
| `--text-sm` | 14 | 0.875 | Meta player |
| `--text-base` | 16 | 1 | Thân player (min mobile) |
| `--text-lg` | 18 | 1.125 | Lựa chọn đáp án player |
| `--text-xl` | 20 | 1.25 | Câu hỏi player |
| `--text-2xl`| 24 | 1.5 | **Min thân BIG SCREEN** |
| `--text-3xl`| 30 | 1.875 | Tiêu đề phụ TV |
| `--text-4xl`| 36 | 2.25 | Prompt TV |
| `--text-5xl`| 48 | 3 | Tiêu đề trạm TV |
| `--text-6xl`| 60 | 3.75 | Heading lớn TV |
| `--text-7xl`| 72 | 4.5 | Tên trạm / BOSS |
| `--text-8xl`| 96 | 6 | **Điểm số TV** |
| `--text-9xl`| 128| 8 | Countdown khổng lồ |

Font weight: `--fw-regular:400`, `--fw-medium:500`, `--fw-semibold:600`, `--fw-bold:700`, `--fw-extrabold:800`.
Line-height: `--lh-tight:1.15` (tiêu đề), `--lh-snug:1.35`, `--lh-normal:1.6` (thân).

### 3.4. Spacing (base 4px)

| Token | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 20 |
| `--space-6` | 24 |
| `--space-8` | 32 |
| `--space-10`| 40 |
| `--space-12`| 48 |
| `--space-16`| 64 |
| `--space-20`| 80 |
| `--space-24`| 96 |

### 3.5. Radius / Shadow / Motion

| Token | Giá trị |
|---|---|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 16px (card mặc định) |
| `--radius-xl` | 24px |
| `--radius-2xl`| 32px |
| `--radius-full`| 9999px |
| `--shadow-sm` | `0 1px 2px rgba(7,26,47,.08)` |
| `--shadow-md` | `0 4px 12px rgba(7,26,47,.12)` |
| `--shadow-lg` | `0 12px 32px rgba(7,26,47,.18)` |
| `--shadow-xl` | `0 24px 60px rgba(7,26,47,.28)` |
| `--shadow-glow`| `0 0 24px rgba(255,184,0,.55)` (kho báu/reveal) |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` |
| `--dur-fast` | 150ms |
| `--dur-base` | 300ms |
| `--dur-slow` | 600ms |

### 3.6. Breakpoints

| Token | min-width | Mục tiêu |
|---|---|---|
| `sm` | 640px | Player ngang / phablet |
| `md` | 768px | Tablet |
| `lg` | 1024px | Host console (min) |
| `xl` | 1280px | Big screen (min) |
| `2xl`| 1536px | Big screen chuẩn |
| `tv` | 1920px | Big screen tối ưu (10-foot) |

> **PLAYER**: thiết kế mặc định `< 640px`. **BIG SCREEN**: mặc định `≥ 1280px`, tối ưu `tv`. **HOST**: `≥ 1024px`.

### 3.7. CSS Variables (nguồn — dán vào `src/shared/tokens/tokens.css`)

```css
:root {
  /* ── Brand: primary (biển xanh) ── */
  --color-primary-900:#071A2F; --color-primary-800:#0A2540;
  --color-primary-700:#0E4C7A; --color-primary-600:#1273C0;
  --color-primary-500:#2E90D9; --color-primary-300:#5AA9E6;
  --color-primary-100:#D6ECFB;
  /* ── Accent (vàng kho báu) ── */
  --color-accent-600:#E0A200; --color-accent-500:#FFB800; --color-accent-300:#FFD666;
  /* ── Semantic ── */
  --color-success:#16A34A; --color-success-bg:#DCFCE7;
  --color-danger:#DC2626;  --color-danger-bg:#FEE2E2;
  --color-warning:#F59E0B; --color-info:#0EA5E9; --color-boss:#7C1D6F;
  /* ── Neutral / text ── */
  --color-neutral-900:#0F172A; --color-neutral-600:#475569;
  --color-neutral-300:#CBD5E1; --color-neutral-100:#F1F5F9;
  /* ── Surfaces ── */
  --color-bg-light:#F0F6FC; --color-surface-light:#FFFFFF;
  --color-bg-dark:#071A2F;  --color-surface-dark:#0E2A47;
  --color-text-on-dark:#E8F2FB;
  /* ── 6 đội ── */
  --team-1:#E11D48; --team-2:#F97316; --team-3:#FACC15;
  --team-4:#22C55E; --team-5:#06B6D4; --team-6:#A855F7;
  /* ── Typography ── */
  --font-display:"Baloo 2","Be Vietnam Pro",system-ui,sans-serif;
  --font-body:"Be Vietnam Pro",system-ui,-apple-system,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,monospace;
  --text-xs:.75rem;  --text-sm:.875rem; --text-base:1rem; --text-lg:1.125rem;
  --text-xl:1.25rem; --text-2xl:1.5rem; --text-3xl:1.875rem; --text-4xl:2.25rem;
  --text-5xl:3rem;   --text-6xl:3.75rem;--text-7xl:4.5rem; --text-8xl:6rem; --text-9xl:8rem;
  --fw-regular:400; --fw-medium:500; --fw-semibold:600; --fw-bold:700; --fw-extrabold:800;
  --lh-tight:1.15; --lh-snug:1.35; --lh-normal:1.6;
  /* ── Spacing ── */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;
  --space-20:80px; --space-24:96px;
  /* ── Radius / shadow / motion ── */
  --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-xl:24px;
  --radius-2xl:32px; --radius-full:9999px;
  --shadow-sm:0 1px 2px rgba(7,26,47,.08);
  --shadow-md:0 4px 12px rgba(7,26,47,.12);
  --shadow-lg:0 12px 32px rgba(7,26,47,.18);
  --shadow-xl:0 24px 60px rgba(7,26,47,.28);
  --shadow-glow:0 0 24px rgba(255,184,0,.55);
  --ease-out:cubic-bezier(.16,1,.3,1);
  --dur-fast:150ms; --dur-base:300ms; --dur-slow:600ms;
  /* ── Alias theo ngữ cảnh sáng (mặc định PLAYER/HOST) ── */
  --bg:var(--color-bg-light); --surface:var(--color-surface-light);
  --text:var(--color-neutral-900); --text-muted:var(--color-neutral-600);
}

/* BIG SCREEN & dark: gắn data-theme="dark" ở root app /present */
:root[data-theme="dark"]{
  --bg:var(--color-bg-dark); --surface:var(--color-surface-dark);
  --text:var(--color-text-on-dark); --text-muted:#9FC0DC;
}
@media (prefers-reduced-motion:reduce){
  :root{ --dur-fast:0ms; --dur-base:0ms; --dur-slow:0ms; }
}
```

---

## 4. Game State Machine

**Một biến phase toàn cục** (`roomState.phase`) do server giữ, gửi cả 3 app. Client là **máy render thuần** theo phase — không tự chuyển phase. **Phần lớn transition do GIÁO VIÊN** kích hoạt (host action); một số do server (hết giờ, đủ người).

### 4.1. Danh sách state

| State | Ý nghĩa | Ai kích hoạt vào state |
|---|---|---|
| `LOBBY` | Phòng mở, chờ SV vào & đặt tên | Host tạo phòng |
| `TEAM_SELECT` | SV chọn/được xếp 1 trong 6 đội | Host `startGame` |
| `INTRO` | Giới thiệu hải trình + cảng đích + luật | Host `next` |
| `STATION_OPEN` | Hiện tên trạm + banner, chưa cho trả lời | Host `openStation` |
| `ANSWERING` | Câu hỏi mở, timer chạy, player gửi đáp án | Host `startAnswering` (hoặc auto sau STATION_OPEN) |
| `LOCKED` | Khóa nhận đáp án (hết giờ hoặc host khóa) | Server (deadline) **hoặc** host `lockAnswers` |
| `REVEAL` | Công bố đáp án đúng + thống kê % lớp | Host `revealAnswer` |
| `KNOWLEDGE_CARD` | Lật "Thẻ Tri Thức" + `explain` | Host `showKnowledgeCard` |
| `LEADERBOARD` | Xếp hạng kép + tàu tiến trên bản đồ | Host `showLeaderboard` |
| `BOSS_INTRO` | Cảnh báo "Cơn Bão Nhà Ở Xã Hội" (điểm x2) | Host `startBoss` |
| `BOSS_ANSWERING` | Câu BOSS đang mở (multiplier) | Host `startAnswering` (trong boss) |
| `BOSS_REVEAL` | Công bố đáp án BOSS + điểm x2 | Host `revealAnswer` |
| `VICTORY` | Tàu về cảng đích, tổng kết vô địch | Host `next` sau boss |
| `ENDED` | Kết thúc, đóng phòng | Host `endGame` |
| `PAUSED` | Tạm dừng giảng (overlay, giữ deadline) | Host `pauseGame` (bất kỳ lúc nào) |
| `FALLBACK` | Mạng lỗi → quiz thuần, tối giản realtime | Host/Server `setMode('fallback')` |

> **Cross-cutting (không phải phase, là `mode`)**: `no-projector` (không máy chiếu — bản đồ/xếp hạng hiện trên điện thoại) là **mode**, phối cùng bất kỳ phase nào. Xem `modeChanged` mục 5.

### 4.2. Sơ đồ chuyển trạng thái (ASCII)

```
                         ┌───────────────── PAUSED ──────────────────┐
                         │  (host pauseGame ↔ resumeGame, giữ mọi phase)
                         ▼                                            ▲
  LOBBY ──startGame──▶ TEAM_SELECT ──next──▶ INTRO ──next──▶ ┐       │
                                                             │       │
        ┌────────────────────────────────────────────────────┘       │
        ▼                                                             │
  ╔══════════════ VÒNG LẶP MỖI TRẠM (Trạm 1→4) ═══════════════╗       │
  ║ STATION_OPEN ─startAnswering─▶ ANSWERING ─┬─deadline───▶ LOCKED   │
  ║                                           └─host lock──▶  │       │
  ║        LOCKED ─revealAnswer─▶ REVEAL ─showCard─▶ KNOWLEDGE_CARD    │
  ║        KNOWLEDGE_CARD ─showLeaderboard─▶ LEADERBOARD ─────┐        │
  ╚══════════════════════════════════════════════════════════╝        │
        │ (còn trạm) nextStation ──▶ STATION_OPEN (quay lại)  │        │
        │ (hết 4 trạm) startBoss                              │        │
        ▼                                                     │        │
  BOSS_INTRO ─startAnswering─▶ BOSS_ANSWERING ─(lock)─▶ ─revealAnswer─▶│
        BOSS_REVEAL ─showLeaderboard─▶ LEADERBOARD ──next──▶ VICTORY   │
                                                              │        │
                                                    endGame   ▼        │
                                                           ENDED ──────┘

  ⟂ FALLBACK: từ BẤT KỲ phase → setMode('fallback') → chạy quiz tối giản,
    bỏ animation nặng; khi mạng ổn → setMode('chuan') quay lại phase hiện tại.
```

Quy tắc:
- `PAUSED` và `FALLBACK` là **overlay/mode**: khi thoát, quay lại phase đang dở (server nhớ `resumePhase`).
- Timer **không reset** khi PAUSED trừ khi host chủ động; deadline mới được `timerSync` lại.
- Client nhận phase lạ (chưa hỗ trợ) → hiển thị màn "đồng bộ…" an toàn, không crash.

---

## 5. HỢP ĐỒNG SOCKET.IO (quan trọng nhất — DỨT KHOÁT)

> Nguồn types: `src/shared/socket/events.ts`. **Client emit đúng tên; server emit đúng tên.** Không sai chính tả, không thêm event ngoài danh sách nếu chưa cập nhật tài liệu này.
> **BẤT DI BẤT DỊCH:**
> 1. Payload gửi PLAYER (`stationOpened`) **KHÔNG chứa đáp án đúng** (`correct` / `isTrue` / `correctBucket` bị lược).
> 2. Đáp án đúng + thống kê chỉ đến qua `answerRevealed`. `explain`/`knowledgeCard` đến qua `knowledgeCard` (sau reveal).
> 3. Timer đồng bộ bằng **`deadlineTs` (epoch ms tuyệt đối từ server)** — client chỉ tính `remaining = deadlineTs - serverNow()`.

### 5.1. Kiểu dùng chung

```ts
// src/shared/socket/events.ts
export type Role = "player" | "screen" | "host";
export type TeamId = 1 | 2 | 3 | 4 | 5 | 6;
export type StationId = 1 | 2 | 3 | 4 | "boss";
export type QuestionType =
  | "mcq" | "selectwrong" | "truefalse" | "dragdrop" | "matching";
export type GamePhase =
  | "LOBBY" | "TEAM_SELECT" | "INTRO"
  | "STATION_OPEN" | "ANSWERING" | "LOCKED" | "REVEAL" | "KNOWLEDGE_CARD"
  | "LEADERBOARD" | "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL"
  | "VICTORY" | "ENDED" | "PAUSED" | "FALLBACK";
export type GameMode = "lite" | "chuan" | "fallback" | "no-projector";

// Câu hỏi ĐÃ LƯỢC đáp án — dạng gửi cho PLAYER/SCREEN
export interface PublicQuestion {
  questionId: string;
  station: StationId;
  stationName: string;
  type: QuestionType;
  topic: string;
  learningLevel: string;   // vd "nhan_biet" | "thong_hieu" | "van_dung"
  difficulty: 1 | 2 | 3;
  timeLimitSec: number;
  basePoints: number;
  prompt: string;
  pointsMultiplier?: number;             // chỉ có ở BOSS (vd 2)
  // Theo type — KHÔNG có trường đáp án:
  options?: { id: string; text: string }[];        // mcq, selectwrong
  statements?: { id: string; text: string }[];      // truefalse
  buckets?: { id: string; name: string }[];         // dragdrop, matching
  items?: { id: string; text: string }[];           // dragdrop, matching
}

// Đáp án player gửi lên — union theo type
export type AnswerPayload =
  | { type: "mcq"; optionId: string }
  | { type: "selectwrong"; optionId: string }
  | { type: "truefalse"; answers: Record<string, boolean> }   // statementId -> Đúng/Sai
  | { type: "dragdrop"; placement: Record<string, string> }    // itemId -> bucketId
  | { type: "matching"; placement: Record<string, string> };   // itemId(trái) -> bucketId(phải)
```

### 5.2. CLIENT → SERVER

```ts
export interface ClientToServer {
  // ── Player ──
  joinRoom: (p: {
    roomCode: string; role: Role; reconnectToken?: string;
  }, ack: (r: { ok: boolean; playerId?: string;
                reconnectToken?: string; error?: string }) => void) => void;

  setNickname: (p: { nickname: string; avatar?: string }) => void;

  chooseTeam: (p: { teamId: TeamId }) => void;

  submitAnswer: (p: {
    questionId: string;
    answer: AnswerPayload;
    clientSentAt: number;   // epoch ms client — server dùng để đối chiếu, KHÔNG tin tuyệt đối
  }, ack: (r: { ok: boolean; received: boolean; error?: string }) => void) => void;

  sendReaction: (p: { emoji: string }) => void;

  rejoin: (p: { reconnectToken: string },
           ack: (r: { ok: boolean; error?: string }) => void) => void;

  // ── Host (chỉ role="host", server kiểm hostToken) ──
  startGame:        (p: { roomCode: string }) => void;
  openStation:      (p: { station: StationId }) => void;
  startAnswering:   (p: { questionId: string }) => void;   // → ANSWERING/BOSS_ANSWERING
  lockAnswers:      (p: { questionId: string }) => void;   // → LOCKED
  revealAnswer:     (p: { questionId: string }) => void;   // → REVEAL/BOSS_REVEAL
  showKnowledgeCard:(p: { questionId: string }) => void;   // → KNOWLEDGE_CARD
  showLeaderboard:  () => void;                            // → LEADERBOARD
  nextStation:      () => void;                            // trạm kế / INTRO→trạm1
  startBoss:        () => void;                            // → BOSS_INTRO
  pauseGame:        () => void;                            // → PAUSED (giữ resumePhase)
  resumeGame:       () => void;                            // thoát PAUSED
  setMode:          (p: { mode: GameMode }) => void;       // lite/chuan/fallback/no-projector
  endGame:          () => void;                            // → ENDED
}
```

### 5.3. SERVER → CLIENT

```ts
export interface ServerToClient {
  // Snapshot toàn phòng — gửi khi join/rejoin & mỗi lần phase đổi
  roomState: (p: {
    roomCode: string;
    phase: GamePhase;
    mode: GameMode;
    currentStation: StationId | null;
    currentQuestionId: string | null;
    serverNow: number;                 // epoch ms server (client tính offset)
    resumePhase?: GamePhase;           // phase để quay lại khi thoát PAUSED/FALLBACK
  }) => void;

  playerList: (p: {
    players: { playerId: string; nickname: string; avatar?: string;
               teamId: TeamId | null; connected: boolean }[];
    counts: { total: number; connected: number;
              perTeam: Record<TeamId, number> };
  }) => void;

  teamAssigned: (p: { playerId: string; teamId: TeamId; teamName: string }) => void;

  // Mở câu hỏi — ĐÃ LƯỢC ĐÁP ÁN
  stationOpened: (p: {
    question: PublicQuestion;          // KHÔNG có correct/isTrue/correctBucket
    phase: "STATION_OPEN" | "ANSWERING" | "BOSS_ANSWERING";
  }) => void;

  // Đồng bộ timer bằng MỐC DEADLINE TUYỆT ĐỐI
  timerSync: (p: {
    questionId: string;
    deadlineTs: number;                // epoch ms tuyệt đối — HẾT GIỜ tại thời điểm này
    serverNow: number;                 // để client tính offset đồng hồ
    durationSec: number;
  }) => void;

  // Đã khóa nhận đáp án
  answerLocked: (p: {
    questionId: string;
    answeredCount: number; totalPlayers: number;
  }) => void;

  // CÔNG BỐ đáp án đúng + thống kê % lớp (chỉ đến ở REVEAL)
  answerRevealed: (p: {
    questionId: string;
    type: QuestionType;
    correct: {
      // Tùy type, khớp cấu trúc questions.json:
      optionId?: string;                       // mcq
      wrongOptionId?: string;                  // selectwrong (phương án SAI cần chọn)
      statements?: Record<string, boolean>;    // truefalse: id -> isTrue
      placement?: Record<string, string>;      // dragdrop/matching: itemId -> correctBucket
    };
    stats: {
      // mcq/selectwrong: % chọn mỗi option; truefalse: % đúng mỗi statement; ...
      optionPct?: Record<string, number>;
      statementCorrectPct?: Record<string, number>;
      bucketCorrectPct?: Record<string, number>;
      classCorrectPct: number;                 // % lớp trả lời đúng câu này
    };
    yourResult?: {                             // chỉ gửi riêng cho player đã trả lời
      isCorrect: boolean;
      pointsEarned: number;                    // đã gồm tốc độ + combo (+ boss x2)
      speedBonus: number;
      streak: number;
    };
  }) => void;

  // Lật THẺ TRI THỨC + giải thích (sau reveal)
  knowledgeCard: (p: {
    questionId: string;
    explain: string;
    knowledgeCard: { title: string; body: string;
                     badge?: string; station: StationId };
  }) => void;

  // Xếp hạng KÉP + vị trí tàu trên bản đồ hải trình
  leaderboardUpdate: (p: {
    players: { playerId: string; nickname: string; teamId: TeamId;
               score: number; streak: number; rank: number }[];
    teams: { teamId: TeamId; teamName: string;
             score: number; rank: number }[];
    shipPositions: { teamId: TeamId;
                     progress: number;        // 0..1 theo hải trình về cảng đích
                     stationReached: StationId }[];
  }) => void;

  // Pha BOSS (cơn bão NOXH, điểm x2)
  bossPhase: (p: {
    phase: "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL";
    pointsMultiplier: number;               // vd 2
    title: string;                          // "Cơn Bão Nhà Ở Xã Hội"
  }) => void;

  // Đổi chế độ (mạng lỗi / không máy chiếu…)
  modeChanged: (p: {
    mode: GameMode;                         // lite | chuan | fallback | no-projector
    reason?: string;
  }) => void;

  // Kết thúc
  gameEnded: (p: {
    winnerTeam: { teamId: TeamId; teamName: string; score: number };
    topPlayers: { playerId: string; nickname: string; score: number }[];
    finalTeams: { teamId: TeamId; score: number; rank: number }[];
  }) => void;

  // Xác nhận đã nhận đáp án (phản hồi UI "đã gửi")
  answerAck: (p: { questionId: string; received: boolean;
                   serverReceivedAt: number }) => void;

  // Reaction phát cho cả phòng (emoji bay)
  reactionBroadcast: (p: { emoji: string; teamId: TeamId | null;
                           nickname?: string }) => void;

  // Lỗi
  errorEvent: (p: { code: string; message: string;
                    fatal: boolean }) => void;
}
```

### 5.4. Quy tắc dùng socket (bắt buộc trong FE)

- **Offset đồng hồ**: khi nhận bất kỳ payload có `serverNow`, tính `clockOffset = serverNow - Date.now()`. Thời gian còn lại = `deadlineTs - (Date.now() + clockOffset)`. Không tin `Date.now()` client trần.
- **Player không bao giờ có đáp án đúng trước `answerRevealed`** — UI reveal chỉ được phép tô đúng/sai **sau** khi nhận `answerRevealed`.
- **`submitAnswer` là idempotent theo `questionId`**: gửi lại (do reconnect) không cộng điểm hai lần; server lấy lần hợp lệ đầu tiên trước deadline.
- **Reconnect**: mất kết nối → `rejoin({reconnectToken})` → server bắn `roomState` + (nếu đang ANSWERING) `stationOpened` + `timerSync` để khôi phục nguyên trạng, **giữ điểm**.
- **FALLBACK**: khi `modeChanged('fallback')`, FE tắt animation nặng/emoji realtime, chỉ giữ vòng hỏi–đáp–chấm (dựa vẫn trên cùng event, giảm tần suất).
- **`no-projector`**: BIG SCREEN không có → PLAYER tự render bản đồ/xếp hạng từ `leaderboardUpdate`.

---

## 6. Cách FE đọc `questions.json` & render theo `type`

**Nguồn dữ liệu runtime cho player = payload `stationOpened.question` (kiểu `PublicQuestion`, ĐÃ lược đáp án).** File `questions.json` gốc (có đáp án) **chỉ tồn tại phía server**. FE render theo `question.type`, dùng registry:

```ts
// src/shared/questions/renderers.ts
const RENDERERS: Record<QuestionType, React.FC<{ q: PublicQuestion; ... }>> = {
  mcq:         McqRenderer,
  selectwrong: SelectWrongRenderer,
  truefalse:   TrueFalseRenderer,
  dragdrop:    DragDropRenderer,
  matching:    MatchingRenderer,
};
// Dùng: const R = RENDERERS[q.type]; <R q={q} onAnswer={...} />
```

Bảng render + đáp án cục bộ (state) + `AnswerPayload` gửi lên:

| `type` | Trường đọc từ `PublicQuestion` | UI player | State cục bộ | `AnswerPayload` khi submit |
|---|---|---|---|---|
| `mcq` | `options[{id,text}]` | Danh sách chọn **1** đáp án | `optionId` | `{type:"mcq", optionId}` |
| `selectwrong` | `options[{id,text}]` | Chọn **1 phương án SAI** (nhấn mạnh "chọn cái SAI") | `optionId` | `{type:"selectwrong", optionId}` |
| `truefalse` | `statements[{id,text}]` | Mỗi nhận định có toggle **Đúng/Sai** | `Record<id,boolean>` | `{type:"truefalse", answers}` |
| `dragdrop` | `buckets[{id,name}]` + `items[{id,text}]` | Kéo-thả mỗi item vào 1 nhóm (bucket) | `Record<itemId,bucketId>` | `{type:"dragdrop", placement}` |
| `matching` | `buckets[{id,name}]` (cột phải) + `items[{id,text}]` (cột trái) | Ghép nối trái→phải | `Record<itemId,bucketId>` | `{type:"matching", placement}` |

Quy tắc render bắt buộc:
- **Không có trường đáp án** (`correct`/`isTrue`/`correctBucket`) trong payload player → FE **không được** giả định/đoán. Trước `answerRevealed`, mọi option ở trạng thái trung tính.
- **Reveal tô màu**: khi có `answerRevealed`, dùng `correct` để tô `--color-success` (đúng) / `--color-danger` (sai) + hiện `stats` (%). Với `truefalse`/`dragdrop`/`matching` tô theo từng `statementId`/`itemId`.
- **BOSS**: nếu `question.pointsMultiplier` tồn tại → hiển thị badge "x2" + áp `--color-boss`.
- **`timeLimitSec`** chỉ để hiển thị/ước lượng UI; **thời điểm hết giờ thật là `timerSync.deadlineTs`** (server) — luôn ưu tiên deadline.
- **Validate phòng thủ**: FE kiểm `q.type ∈ QuestionType` và có đủ trường (`options`/`statements`/`buckets+items`) trước khi render; thiếu → hiển thị "Đang tải câu hỏi…" thay vì crash.
- **BIG SCREEN**: với `mcq/selectwrong` có thể chỉ hiện `prompt` + số lượng lựa chọn (đọc từ xa); chi tiết option để player đọc trên điện thoại. `dragdrop/matching` trên BIG SCREEN hiện tên bucket + đếm bao nhiêu đội đã nộp.

---

### Phụ lục — Bảng tra nhanh tên (chốt, cho spec khác trích dẫn)

- **Routes**: `/play` · `/present` · `/host`
- **Roles**: `player` · `screen` · `host`
- **Phases**: `LOBBY, TEAM_SELECT, INTRO, STATION_OPEN, ANSWERING, LOCKED, REVEAL, KNOWLEDGE_CARD, LEADERBOARD, BOSS_INTRO, BOSS_ANSWERING, BOSS_REVEAL, VICTORY, ENDED, PAUSED, FALLBACK`
- **Modes**: `lite · chuan · fallback · no-projector`
- **Types**: `mcq · selectwrong · truefalse · dragdrop · matching`
- **Stations**: `1 Đảo Khái Niệm · 2 Eo Biển Tất Yếu · 3 Quần Đảo Đặc Trưng · 4 Cảng Thể Chế · boss Cơn Bão Nhà Ở Xã Hội (x2)`
- **C→S**: `joinRoom, setNickname, chooseTeam, submitAnswer, sendReaction, rejoin` + host: `startGame, openStation, startAnswering, lockAnswers, revealAnswer, showKnowledgeCard, showLeaderboard, nextStation, startBoss, pauseGame, resumeGame, setMode, endGame`
- **S→C**: `roomState, playerList, teamAssigned, stationOpened, timerSync, answerLocked, answerRevealed, knowledgeCard, leaderboardUpdate, bossPhase, modeChanged, gameEnded, answerAck, reactionBroadcast, errorEvent`

> Bất kỳ thay đổi tên token/event/state PHẢI cập nhật tài liệu này trước, rồi mới đổi code.

---

# PHẦN B — GIAO DIỆN NGƯỜI CHƠI

## Giao diện NGƯỜI CHƠI (Player – điện thoại)

> **Route:** `/play` (hoặc `/`) · **role socket:** `"player"` · **app:** `src/apps/player` · **thiết bị:** màn dọc 360–430px, trình duyệt điện thoại, không cài app.
> Toàn bộ màn player là **máy render thuần theo `roomState.phase`** (mục 4). Player **không tự chuyển phase** — **giáo viên (host) điều nhịp** bằng host action; một số transition do server (deadline). Player chỉ được phép: `joinRoom, setNickname, chooseTeam, submitAnswer, sendReaction, rejoin`.
> **3 luật vàng luôn áp dụng:** (1) payload player đã **lược đáp án đúng**; (2) chỉ tô đúng/sai **sau `answerRevealed`**; (3) đồng hồ tính bằng `deadlineTs - (Date.now() + clockOffset)`.

---

### Bản đồ phase → màn player (điều phối bởi host)

| `roomState.phase` | Màn player render | Host action đưa vào phase |
|---|---|---|
| (chưa join) | **(1)** Nhập mã / quét QR | — |
| `LOBBY` | **(2)** Đặt nickname → **(4)** Sảnh chờ | Host tạo phòng |
| `TEAM_SELECT` | **(3)** Chọn/chia đội | `startGame` |
| `INTRO` | **(5)** Giới thiệu hải trình | `nextStation` / `next` |
| `STATION_OPEN` | **(11)** Chờ giữa bước (banner trạm) | `openStation` |
| `ANSWERING` / `BOSS_ANSWERING` | **(6–10)** Màn thử thách theo `type` | `startAnswering` |
| `LOCKED` | **(11)** Chờ giữa bước ("Đã khóa – chờ công bố") | `lockAnswers` / server deadline |
| `REVEAL` / `BOSS_REVEAL` | **(13a)** Kết quả cá nhân (đúng/sai + điểm) | `revealAnswer` |
| `KNOWLEDGE_CARD` | **(12)** Lật Thẻ Tri Thức | `showKnowledgeCard` |
| `LEADERBOARD` | **(13b)** Thứ hạng + tàu tiến | `showLeaderboard` |
| `BOSS_INTRO` | **(11-boss)** Cảnh báo Cơn Bão NOXH (x2) | `startBoss` |
| `VICTORY` | **(13c)** Về cảng đích – tổng kết | `next` sau boss |
| `ENDED` | **(13d)** Kết thúc – cảm ơn | `endGame` |
| `PAUSED` | Overlay "Tạm dừng" (đè mọi màn) | `pauseGame` |
| `FALLBACK` | **(16)** Chế độ quiz tối giản | `setMode('fallback')` |
| mode `no-projector` | **(16)** Bản đồ/xếp hạng render trên điện thoại | `setMode('no-projector')` |

**Reaction (14)** phủ toàn app: nút emoji nổi ở mọi phase chơi (không cản trả lời).

---

### Khung chung mọi màn — `PlayerShell`

Mọi màn player nằm trong một shell cố định: **thanh trạng thái trên** + **thân theo phase** + **thanh hành động đáy (bottom action bar)**. Nút chính neo đáy, cao `≥ 56px` (token `--space-14` ~ dùng `min-h:56px`), touch target `≥ 44×44px`.

```
┌────────────────────────────────────┐  ← TopStatusBar (sticky top)
│ 🧭 ABCD   [🟥 San Hô]      ⚡128  ●  │
│ PIN·mono  TeamBadge      Score  Conn│
├────────────────────────────────────┤
│                                    │
│           THÂN THEO PHASE          │  ← <PhaseRouter phase={roomState.phase}/>
│        (một việc mỗi màn)          │
│                                    │
├────────────────────────────────────┤
│  [   NÚT HÀNH ĐỘNG CHÍNH  ≥56px ]  │  ← BottomActionBar (sticky)
└────────────────────────────────────┘
        😮 🔥 👏 😂  ← ReactionBar (nút nổi, mục 14)
```

**Component khung dùng lại toàn app:** `PlayerShell`, `TopStatusBar`, `ConnectionBadge` (`●` xanh = connected, `◐` vàng = reconnecting, `○` đỏ = mất), `TeamBadge` (màu `--team-{teamId}`), `ScoreChip`, `BottomActionBar`, `PrimaryButton`, `SyncScreen` (màn "đồng bộ…" an toàn cho phase lạ), `NetworkBanner`, `PausedOverlay`, `ReactionLayer`, `Toast`.

**Store client (shared) — trường tham chiếu ở mọi màn:**
`phase, mode, roomCode, playerId, reconnectToken, clockOffset, connected, teamId, teamName, nickname, avatar, score, streak, currentStation, currentQuestionId, deadlineTs, durationSec, answerState, localAnswer, question(PublicQuestion), yourResult`.
`answerState ∈ { idle | selecting | submitting | submitted | locked | revealed }`.

**Đồng hồ (dùng chung mọi màn thử thách):** khi nhận bất kỳ payload có `serverNow` → `clockOffset = serverNow - Date.now()`; `remaining = deadlineTs - (Date.now() + clockOffset)`. Không đếm ngược client độc lập.

---

## (1) Màn Nhập mã / Quét QR — `JoinScreen`

**MỤC ĐÍCH:** Đưa SV vào đúng phòng bằng mã 4 ký tự hoặc quét QR chiếu trên BIG SCREEN, trước khi vào `LOBBY`. Đây là màn duy nhất **trước khi có phase** (chưa join room).

**WIREFRAME:**
```
┌────────────────────────────────────┐
│        🧭  HÀNH TRÌNH ĐỊNH HƯỚNG    │
│         Vượt 5 Trạm Tri Thức        │
│                                    │
│      ~~~~~~~ 🌊 sóng biển ~~~~~~~    │
│                                    │
│   Nhập MÃ PHÒNG (4 ký tự)          │
│   ┌────┬────┬────┬────┐            │
│   │ A  │ B  │ C  │ D  │  ← mono    │
│   └────┴────┴────┴────┘            │
│                                    │
│   ── hoặc ──                        │
│   ┌──────────────────────────┐     │
│   │   📷  QUÉT MÃ QR          │     │  → mở camera
│   └──────────────────────────┘     │
│                                    │
│   ⚠ Sai mã phòng, thử lại          │  ← errorEvent
├────────────────────────────────────┤
│   [        VÀO PHÒNG        ]       │  ← BottomActionBar
└────────────────────────────────────┘
```

**COMPONENT:** `RoomPinInput` (4 ô mono, auto-focus/auto-advance, uppercase), `QrScanButton` (mở `getUserMedia`; đọc URL `/play?room=ABCD` → tách `room`), `JoinCta` (PrimaryButton), `JoinError` (Toast/banner).

**STATE:** `roomCode` (nhập tay hoặc từ QR/query `?room=`), `connected`, `joinState ∈ {idle|connecting|error}`. Lưu `reconnectToken` (nếu có trong localStorage) để join lại.

**SỰ KIỆN SOCKET:**
- **Phát:** `joinRoom({ roomCode, role:"player", reconnectToken? })` với `ack(r)`.
- **Nhận (ack):** `{ ok, playerId, reconnectToken, error? }` → lưu `playerId` + `reconnectToken` (persist localStorage).
- **Nhận:** `roomState` (snapshot đầu tiên → biết `phase` để điều hướng: `LOBBY`→(2), hoặc thẳng vào phase đang chạy nếu vào muộn) · `errorEvent{code,message,fatal}` (sai mã/phòng đầy/đóng).

**EDGE CASE:**
- Vào bằng link QR `?room=ABCD` → prefill mã, có thể tự `joinRoom`.
- Phòng đang chạy giữa chừng (host đã `startGame`) → `ack.ok` nhưng `roomState.phase` không phải LOBBY → nhảy vào màn tương ứng (ví dụ đã có nickname/teamId từ reconnectToken thì vào thẳng; nếu chưa có nickname → ép qua (2)).
- `ack.ok=false` (mã sai / phòng đầy / `ENDED`) → hiện `JoinError`, giữ ở màn này.
- Trình duyệt chặn camera → ẩn nút QR, chỉ còn nhập tay.
- Mất mạng khi bấm Vào → nút chuyển spinner, tự retry khi `connected` lại.

---

## (2) Màn Đặt nickname (bộ lọc từ cấm) — `NicknameScreen`

**MỤC ĐÍCH:** SV đặt tên hiển thị + chọn avatar khi phòng ở `LOBBY`. Lọc từ cấm ngay tại client trước khi gửi (UX nhanh), server vẫn là nơi chốt.

**WIREFRAME:**
```
┌────────────────────────────────────┐
│ 🧭 ABCD                        ○    │
│                                    │
│   Bạn tên là gì, thủy thủ? ⚓        │
│                                    │
│   ┌──────────────────────────┐     │
│   │ Minh Bão            12/16 │     │  ← ô nhập, đếm ký tự
│   └──────────────────────────┘     │
│   ⚠ Tên chứa từ không phù hợp       │  ← cảnh báo lọc (nếu dính)
│                                    │
│   Chọn linh vật:                    │
│   [🐬][🐠][🦀][🐙][⛵][🦑][🏴‍☠️][🐚]│  ← AvatarPicker
│    ●                               │
├────────────────────────────────────┤
│   [        SẴN SÀNG!        ]       │  ← disabled đến khi hợp lệ
└────────────────────────────────────┘
```

**COMPONENT:** `NicknameInput` (đếm ký tự, giới hạn ~2–16), `ProfanityHint` (cảnh báo đỏ `--color-danger`), `AvatarPicker` (grid emoji), `ReadyCta`.

**STATE:** `nickname`, `avatar`, `nickValid` (đủ dài + qua `profanityFilter` cục bộ), `submitting`. Bộ lọc: hàm client `isClean(nickname)` (danh sách từ cấm client-side, chuẩn hoá bỏ dấu/khoảng trắng) → chỉ chặn UI, **không** quyết định điểm.

**SỰ KIỆN SOCKET:**
- **Phát:** `setNickname({ nickname, avatar? })` (chỉ khi `nickValid`).
- **Nhận:** `playerList` (thấy tên mình đã vào danh sách → sang (4) Sảnh chờ) · `roomState` (nếu host `startGame` → `TEAM_SELECT` → sang (3)) · `errorEvent` (server từ chối tên trùng/cấm → hiện lại cảnh báo).

**EDGE CASE:**
- Tên dính từ cấm → nút disabled + `ProfanityHint`; không gửi `setNickname`.
- Tên trùng trong phòng → server có thể trả `errorEvent`/`playerList` cho hậu tố; hiển thị gợi ý đổi tên.
- Rớt mạng sau khi gửi nhưng chưa thấy trong `playerList` → giữ nút "Sẵn sàng", tự gửi lại khi reconnect (idempotent theo `playerId`).
- Host đã chuyển `TEAM_SELECT` khi SV còn gõ tên → vẫn cho hoàn tất rồi đẩy sang (3).

---

## (3) Màn Chọn / chia đội — `TeamSelectScreen`

**MỤC ĐÍCH:** Trong phase `TEAM_SELECT`, SV chọn 1 trong 6 đội (hoặc nhận đội do host/server xếp). Mỗi đội màu cố định (mục 3.2), hiển thị sĩ số cân bằng.

**WIREFRAME:**
```
┌────────────────────────────────────┐
│ 🧭 ABCD   chọn đội của bạn      ●   │
│                                    │
│  ┌────────────┐  ┌────────────┐    │
│  │🟥 Hồng San │  │🟧 Cam Hải  │    │
│  │   Hô  (4)  │  │  Đăng (5)  │    │
│  └────────────┘  └────────────┘    │
│  ┌────────────┐  ┌────────────┐    │
│  │🟨 Vàng Cánh│  │🟩 Lục Rong │    │
│  │  Buồm (4)  │  │  Biển (5)  │◀── │  ← đang chọn (viền đậm)
│  └────────────┘  └────────────┘    │
│  ┌────────────┐  ┌────────────┐    │
│  │🟦 Lam Sóng │  │🟪 Tím Hải  │    │
│  │  Bạc (4)   │  │  Vương (3) │    │
│  └────────────┘  └────────────┘    │
├────────────────────────────────────┤
│   [   VÀO ĐỘI LỤC RONG BIỂN   ]     │
└────────────────────────────────────┘
```

**COMPONENT:** `TeamCard` × 6 (nền `--team-{n}`, tên hiển thị theo mục 3.2, badge sĩ số từ `counts.perTeam`), `TeamGrid` (2 cột), `JoinTeamCta`. Trạng thái được xếp tự động → hiện overlay "Bạn thuộc **{teamName}**" thay vì lưới.

**STATE:** `teamId` (lựa chọn tạm), `teams counts` (từ `playerList.counts.perTeam`), `assigned` (đã chốt). `teamId` map trực tiếp `--team-{teamId}`.

**SỰ KIỆN SOCKET:**
- **Phát:** `chooseTeam({ teamId })`.
- **Nhận:** `teamAssigned({ playerId, teamId, teamName })` → chốt `teamId/teamName`, cập nhật `TeamBadge` toàn shell · `playerList` (cập nhật sĩ số realtime) · `roomState` (host `nextStation`/`next` → `INTRO` → sang (5)).

**EDGE CASE:**
- Chế độ host tự chia đội (không cho chọn) → ẩn lưới, chỉ chờ `teamAssigned`.
- Đội đầy/khoá cân bằng → server có thể trả `errorEvent` → card đó mờ, chọn lại.
- Chọn xong nhưng host chưa qua INTRO → ở màn "Đã vào {teamName}, chờ thuyền trưởng…" (một dạng (11)).
- Reconnect giữa TEAM_SELECT: `roomState`+`teamAssigned` khôi phục đội đã chọn, không cho đổi nếu server đã khoá.

---

## (4) Màn Sảnh chờ (Lobby) — `LobbyScreen`

**MỤC ĐÍCH:** Sau khi đặt tên (và trước/trong lúc chờ host `startGame`), SV thấy phòng đang tụ họp: mã phòng, tổng người, cảm giác "sắp khởi hành". Host là người bấm bắt đầu → SV chỉ chờ.

**WIREFRAME:**
```
┌────────────────────────────────────┐
│ 🧭 ABCD                         ●   │
│                                    │
│      ⛵  Chờ thuyền trưởng...       │
│                                    │
│      Đã lên tàu: 27 thủy thủ        │  ← counts.connected
│   ┌──────────────────────────┐     │
│   │ 🐬 Minh Bão   (bạn)       │     │
│   │ 🦀 Lan Sóng               │     │
│   │ ⛵ Huy Cá     🟢          │     │  ← playerList cuộn
│   │ 🐙 Trang ...              │     │
│   └──────────────────────────┘     │
│                                    │
│   ⓘ Giữ máy sáng, sắp khởi hành!    │
├────────────────────────────────────┤
│   ⏳ Đang chờ giáo viên bắt đầu…    │  ← không có nút (host điều nhịp)
└────────────────────────────────────┘
        😮 🔥 👏 😂  ← ReactionBar
```

**COMPONENT:** `LobbyHeader` (PIN mono + tổng người), `PlayerRoster` (list cuộn, đánh dấu "bạn", chấm connected), `WaitingHint`, `ReactionBar`. Không có nút hành động — nhấn mạnh **host điều nhịp**.

**STATE:** `players[]`, `counts.total/connected`, `phase` (`LOBBY`). Reaction bật ở đây để "khởi động không khí".

**SỰ KIỆN SOCKET:**
- **Phát:** `sendReaction({ emoji })` (tùy chọn) · `setNickname` (nếu muốn sửa tên trước khi bắt đầu — nếu cho phép).
- **Nhận:** `playerList` (roster + counts realtime) · `reactionBroadcast` (emoji bay, mục 14) · `roomState` (host `startGame` → `TEAM_SELECT` → (3)).

**EDGE CASE:**
- Vào muộn khi phase đã qua LOBBY → không dừng ở đây, đẩy thẳng theo `roomState.phase`.
- Người khác rớt mạng → `connected=false` hiển thị mờ trong roster (không xoá).
- Máy ngủ/khoá → khi mở lại, `rejoin` khôi phục, quay về đúng phase (mục 15).
- `PAUSED` xảy ra ngay ở lobby → `PausedOverlay` phủ, không thao tác.

---

## (5) Màn Giới thiệu hải trình — `IntroScreen`

**MỤC ĐÍCH:** Phase `INTRO` — cho SV thấy toàn cảnh: 4 trạm + BOSS + cảng đích, luật chơi (điểm/tốc độ/combo/x2 BOSS). Host bấm `nextStation` để mở Trạm 1.

**WIREFRAME:**
```
┌────────────────────────────────────┐
│ 🧭 ABCD   [🟩 Lục Rong Biển]    ●   │
│                                    │
│      HÀNH TRÌNH 5 TRẠM TRI THỨC     │
│                                    │
│  ①─── Đảo Khái Niệm                 │
│   │                                │
│  ②─── Eo Biển Tất Yếu               │
│   │                                │
│  ③─── Quần Đảo Đặc Trưng            │
│   │                                │
│  ④─── Cảng Thể Chế                  │
│   │                                │
│  ⚡ CƠN BÃO NHÀ Ở XÃ HỘI (x2)       │  ← --color-boss
│   │                                │
│  🏁 CẢNG ĐÍCH: Dân giàu · Nước mạnh │
│      Dân chủ · Công bằng · Văn minh │
│                                    │
│  Luật: nhanh + đúng = combo 🔥      │
├────────────────────────────────────┤
│   ⏳ Chờ mở Trạm 1…                 │
└────────────────────────────────────┘
```

**COMPONENT:** `JourneyMap` (dọc, 4 trạm + boss + cảng đích, tên trạm theo phụ lục), `RulesStrip`, `DestinationBanner` (cảng đích cố định mục 1.4). Không nút — chờ host.

**STATE:** `phase='INTRO'`, `currentStation=null`. Chỉ đọc.

**SỰ KIỆN SOCKET:**
- **Nhận:** `roomState` (xác nhận INTRO) · `roomState`/`stationOpened` khi host `openStation` → `STATION_OPEN` → (11)/(6–10) · `reactionBroadcast`.
- **Phát:** `sendReaction` (tùy chọn).

**EDGE CASE:** `prefers-reduced-motion` → tắt animation tàu chạy. Reconnect ở INTRO → khôi phục nguyên màn. `FALLBACK` → hiện bản rút gọn (danh sách trạm, bỏ animation).

---

## Khung chung 5 màn thử thách (6–10) — `ChallengeScreen`

5 màn (6)–(10) **chia sẻ cùng một khung**: header câu hỏi + đồng hồ đồng bộ + vùng renderer theo `type` + bottom action. Khác nhau ở **renderer** (`RENDERERS[q.type]`, mục 6). Áp dụng cho cả `ANSWERING` và `BOSS_ANSWERING` (thêm badge **x2** + màu `--color-boss`).

**Đồng hồ đếm ngược đồng bộ — `CountdownRing`:** vòng tròn + số giây, đọc `deadlineTs` từ `timerSync`; `remaining = deadlineTs-(Date.now()+clockOffset)`. Đổi màu: `>50%` primary → `≤50%` `--color-warning` → `≤10%` `--color-danger` + rung nhẹ. `timeLimitSec` chỉ để ước lượng UI ban đầu; **deadline server là thật**.

**`answerState` (chung mọi thử thách):**
`idle` (chưa thấy câu) → `selecting` (đang chọn/kéo, chưa gửi) → `submitting` (đã bấm gửi, chờ `answerAck`, khoá input + spinner) → `submitted` (đã có `answerAck.received=true`, khoá lựa chọn, chờ) → `locked` (nhận `answerLocked`/phase `LOCKED`, hết cơ hội) → `revealed` (nhận `answerRevealed`, tô đúng/sai + điểm).

**Header chung:**
```
┌────────────────────────────────────┐
│ 🧭 ABCD  [🟩 Rong Biển]  ⚡128  ●   │
│ Trạm ③ · Quần Đảo Đặc Trưng   🔥x3  │  ← station + streak
│                    ┌─────┐         │
│  câu hỏi bên dưới… │ ◔ 12│  ← Ring  │
│                    └─────┘         │
```

**Component chung:** `ChallengeHeader` (station/topic/streak), `CountdownRing`, `QuestionPrompt`, `RendererSlot` (`RENDERERS[q.type]`), `SubmitBar` (BottomActionBar), `SubmittedOverlay` (spinner "Đã gửi – chờ cả lớp"), `BossBadge` (x2). **STATE chung:** `question(PublicQuestion)`, `deadlineTs`, `durationSec`, `localAnswer`, `answerState`, `streak`, `pointsMultiplier?`.

**SỰ KIỆN chung:**
- **Nhận:** `stationOpened({question, phase})` (đã lược đáp án) → dựng renderer · `timerSync({deadlineTs,serverNow,durationSec})` → chạy Ring · `answerLocked` → `answerState='locked'` · `answerRevealed` → (13a) · `bossPhase` (nếu boss).
- **Phát:** `submitAnswer({questionId, answer, clientSentAt:Date.now()}, ack)`; nhận `answerAck({received, serverReceivedAt})`.

**EDGE CASE chung (mọi thử thách):**
- **Idempotent:** gửi lại sau reconnect **không cộng điểm 2 lần** (server lấy lần hợp lệ đầu trước deadline). UI vẫn hiện "đã gửi".
- **Hết giờ mà chưa gửi:** khi `remaining≤0` hoặc nhận `answerLocked` → khoá input, `answerState='locked'`, hiện "Hết giờ – chờ công bố".
- **`answerAck` không về:** giữ `submitting` với spinner, cho retry ngầm; khi `answerLocked` tới thì dừng.
- **Payload thiếu/hỏng:** validate `q.type` + đủ trường (`options`/`statements`/`buckets+items`) → nếu thiếu, hiện "Đang tải câu hỏi…" (không crash, mục 6).
- **Không tô đúng/sai trước `answerRevealed`** — mọi lựa chọn trung tính.
- **PAUSED giữa lúc trả lời:** `PausedOverlay` phủ, Ring giữ `deadlineTs` (chỉ đổi nếu host `timerSync` lại).

---

## (6) Thử thách — MCQ — `McqRenderer`

**MỤC ĐÍCH:** Chọn **1** đáp án đúng trong danh sách (`options`).

**WIREFRAME:**
```
│ Đặc trưng nào KHÔNG…?  (chọn 1)     │
│ ┌────────────────────────────────┐ │
│ │ A. Kinh tế nhiều thành phần    │ │
│ ├────────────────────────────────┤ │
│ │ B. Phân phối theo lao động   ◀ │ │  ← đang chọn (viền primary)
│ ├────────────────────────────────┤ │
│ │ C. Nhà nước pháp quyền XHCN    │ │
│ ├────────────────────────────────┤ │
│ │ D. Kinh tế thị trường          │ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│   [        GỬI ĐÁP ÁN         ]     │
```
Reveal (sau `answerRevealed`):
```
│ │ B. …  ✓ ĐÚNG  (62% lớp chọn) │🟩│ │  ← --color-success
│ │ D. …  ✗       (18%)          │🟥│ │  ← nếu bạn chọn sai
```

**COMPONENT:** `OptionButton` × N (radio-style, 1 chọn), `OptionStatBar` (hiện `stats.optionPct` sau reveal).
**STATE:** `localAnswer.optionId`.
**SỰ KIỆN — Phát:** `submitAnswer({questionId, answer:{type:"mcq", optionId}, clientSentAt})`. **Nhận:** `answerRevealed.correct.optionId` + `stats.optionPct` → tô đúng ô `optionId`, tô đỏ ô bạn chọn nếu sai.
**EDGE CASE:** chưa chọn → nút disabled; đổi lựa chọn tự do trước khi gửi.

---

## (7) Thử thách — Chọn phương án SAI — `SelectWrongRenderer`

**MỤC ĐÍCH:** Cùng dạng danh sách `options` nhưng **chọn 1 phương án SAI**. Phải nhấn mạnh "chọn cái SAI" để tránh nhầm.

**WIREFRAME:**
```
│ ⚠ CHỌN PHƯƠNG ÁN SAI  (bẫy ngược!) │  ← banner warning nổi bật
│ ┌────────────────────────────────┐ │
│ │ A. …                           │ │
│ │ B. …                        ◀  │ │  ← đang chọn "cái sai"
│ │ C. …                           │ │
│ │ D. …                           │ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│   [   CHỌN CÂU NÀY LÀ SAI    ]      │
```
Reveal: phương án SAI cần chọn = `correct.wrongOptionId` → tô `--color-success` (bạn chọn đúng "cái sai") hoặc đỏ nếu chọn nhầm.

**COMPONENT:** `WrongPickBanner` (nhắc chọn cái sai, màu `--color-warning`), `OptionButton` × N, `OptionStatBar`.
**STATE:** `localAnswer.optionId`.
**SỰ KIỆN — Phát:** `submitAnswer({..., answer:{type:"selectwrong", optionId}})`. **Nhận:** `answerRevealed.correct.wrongOptionId` + `stats.optionPct`.
**EDGE CASE:** dễ nhầm ngữ nghĩa → label nút và banner khác biệt màu/chữ so với MCQ; nhắc lại "SAI" ngay tại nút gửi.

---

## (8) Thử thách — Đúng/Sai nhiều nhận định — `TrueFalseRenderer`

**MỤC ĐÍCH:** Nhiều `statements`, mỗi nhận định gạt **Đúng/Sai**. Chỉ gửi khi **đã trả lời hết** các nhận định.

**WIREFRAME:**
```
│ Gạt Đúng/Sai từng nhận định:        │
│ ┌────────────────────────────────┐ │
│ │ 1. Kinh tế thị trường là…      │ │
│ │        [ ĐÚNG |•SAI ]          │ │  ← toggle
│ ├────────────────────────────────┤ │
│ │ 2. Nhà nước không can thiệp…   │ │
│ │        [•ĐÚNG| SAI ]           │ │
│ ├────────────────────────────────┤ │
│ │ 3. …               (chưa chọn) │ │  ← nhắc còn thiếu
│ │        [ ĐÚNG | SAI ]          │ │
│ └────────────────────────────────┘ │
│  Đã trả lời 2/3                     │
├────────────────────────────────────┤
│   [   GỬI (còn 1 nhận định)   ]     │  ← disabled đến khi đủ
```
Reveal: mỗi dòng tô theo `correct.statements[id]` vs lựa chọn của bạn; hiện `stats.statementCorrectPct[id]`.

**COMPONENT:** `StatementRow` × N (`TrueFalseToggle`), `AnsweredCounter` (x/N), `SubmitBar`.
**STATE:** `localAnswer.answers: Record<statementId, boolean>`.
**SỰ KIỆN — Phát:** `submitAnswer({..., answer:{type:"truefalse", answers}})`. **Nhận:** `answerRevealed.correct.statements` (`id→isTrue`) + `stats.statementCorrectPct`.
**EDGE CASE:** thiếu nhận định → nút disabled + đếm; hết giờ khi còn thiếu → gửi phần đã có (hoặc coi như chưa nộp tùy server) và khoá.

---

## (9) Thử thách — Kéo–thả vào nhóm — `DragDropRenderer`

**MỤC ĐÍCH:** Phân loại `items` vào các `buckets`. **UX chạm điện thoại:** ô thả **đủ lớn** (`min-h:64px`, `--space-16`), kéo mượt, và **nút xác nhận riêng "⚓ Neo hàng"** để chốt (tránh thả nhầm là gửi luôn).

**WIREFRAME:**
```
│ Kéo mỗi thẻ vào đúng nhóm:          │
│ CHƯA XẾP:  [ Thẻ 1 ][ Thẻ 2 ]      │  ← khay item (kéo ra)
│            [ Thẻ 3 ]               │
│ ┌─────────────┐ ┌─────────────┐    │
│ │ 🅐 Kinh tế   │ │ 🅑 Chính trị │    │  ← bucket, ô lớn
│ │ ┌─────────┐ │ │             │    │
│ │ │ Thẻ 2   │ │ │  (trống)    │    │
│ │ └─────────┘ │ │             │    │
│ └─────────────┘ └─────────────┘    │
│  Đã xếp 1/3                          │
├────────────────────────────────────┤
│   [        ⚓ NEO HÀNG        ]      │  ← xác nhận = submit
```
Reveal: mỗi item tô xanh/đỏ theo `correct.placement[itemId]`; hiện `stats.bucketCorrectPct`.

**COMPONENT:** `ItemChip` (kéo, hỗ trợ touch: `pointer events`), `BucketZone` (drop lớn, đổi nền khi hover-drag), `UnplacedTray`, `NeoHangCta` ("⚓ Neo hàng"), `PlacedCounter`. Hỗ trợ **tap-to-place** dự phòng (chạm thẻ → chạm nhóm) cho máy khó kéo.
**STATE:** `localAnswer.placement: Record<itemId, bucketId>`.
**SỰ KIỆN — Phát:** `submitAnswer({..., answer:{type:"dragdrop", placement}})` khi bấm **Neo hàng**. **Nhận:** `answerRevealed.correct.placement` + `stats.bucketCorrectPct`.
**EDGE CASE:** kéo lỗi trên iOS Safari → fallback tap-to-place; chưa xếp hết → nút "Neo hàng" disabled + đếm; hết giờ → khoá vị trí hiện tại; xoay ngang màn → giữ layout dọc (khuyến nghị dọc).

---

## (10) Thử thách — Ghép trái–phải — `MatchingRenderer`

**MỤC ĐÍCH:** Ghép mỗi `items` (cột trái) với đúng `buckets` (cột phải). Chạm trái rồi chạm phải để nối (đường nối/nhãn), có nút chốt.

**WIREFRAME:**
```
│ Nối khái niệm (trái) ↔ định nghĩa:  │
│  TRÁI            PHẢI               │
│ ┌──────────┐    ┌──────────────┐   │
│ │① Dân giàu │──▶ │ a. Kinh tế…  │   │  ← đã nối
│ ├──────────┤    ├──────────────┤   │
│ │② Nước mạnh│◀ chọn            │   │  ← đang chọn trái
│ ├──────────┤    │ b. Quốc phòng│   │
│ │③ Dân chủ  │    ├──────────────┤   │
│ └──────────┘    │ c. Quyền dân │   │
│                 └──────────────┘   │
│  Đã nối 1/3                          │
├────────────────────────────────────┤
│   [        ⚓ CHỐT GHÉP        ]     │
```
Reveal: mỗi cặp tô theo `correct.placement[itemId]` (itemId trái → bucketId phải đúng); `stats.bucketCorrectPct`.

**COMPONENT:** `MatchColumnLeft` (`items`), `MatchColumnRight` (`buckets`), `MatchLink` (đường/nhãn nối), `SelectPairFlow` (tap trái→tap phải), `ConfirmMatchCta`, `MatchedCounter`.
**STATE:** `localAnswer.placement: Record<itemId(trái), bucketId(phải)>`; `selecting` (item trái đang chờ nối).
**SỰ KIỆN — Phát:** `submitAnswer({..., answer:{type:"matching", placement}})`. **Nhận:** `answerRevealed.correct.placement` + `stats.bucketCorrectPct`.
**EDGE CASE:** nối lại đè nối cũ (1 trái ↔ 1 phải); chưa nối hết → nút disabled; nhiều cặp trên màn hẹp → cột cuộn độc lập; hết giờ → khoá.

> **Biến thể BOSS (áp cho 6–10):** phase `BOSS_ANSWERING`, `question.pointsMultiplier=2` → header đổi `--color-boss`, badge **"⚡ x2 CƠN BÃO NHÀ Ở XÃ HỘI"**, Ring viền tím bão. Nhận `bossPhase({phase:"BOSS_ANSWERING", pointsMultiplier, title})`. Điểm reveal đã nhân x2 (server-side).

---

## (11) Màn "Chờ" giữa các bước — `SyncScreen` / `StandbyScreen`

**MỤC ĐÍCH:** Lấp các khoảng **do host điều nhịp**: `STATION_OPEN` (đã mở trạm, chưa cho trả lời), `LOCKED` (đã khóa, chờ công bố), và mọi khoảng chuyển. "Một việc mỗi màn" → không nhồi nội dung. Nhấn mạnh **đang chờ giáo viên**.

**WIREFRAME (STATION_OPEN):**
```
┌────────────────────────────────────┐
│ 🧭 ABCD  [🟩 Rong Biển]  ⚡128  ●   │
│                                    │
│         ⚓  TRẠM ③                  │
│      QUẦN ĐẢO ĐẶC TRƯNG             │
│      ~~~~ 🌊 ~~~~                    │
│                                    │
│   Chuẩn bị… câu hỏi sắp mở!         │
│        ● ● ●  (nhịp chờ)            │
├────────────────────────────────────┤
│   ⏳ Chờ giáo viên mở câu hỏi       │
└────────────────────────────────────┘
```
**WIREFRAME (LOCKED — đã gửi/hết giờ, chờ reveal):**
```
│        🔒  ĐÃ KHÓA ĐÁP ÁN           │
│   Đáp án của bạn đã ghi nhận ✓      │
│   Đang chờ công bố kết quả…         │
│        (spinner sóng)              │
│   😮 🔥 👏 😂  ← vẫn reaction được   │
```

**COMPONENT:** `StationBanner` (tên trạm theo phụ lục), `StandbyPulse`, `LockedNotice`, `SyncScreen` (dùng cho **phase lạ/chưa hỗ trợ** → "Đang đồng bộ…" an toàn), `ReactionBar`.
**STATE:** `phase ∈ {STATION_OPEN, LOCKED, hoặc bất kỳ transitional}`, `answerState='submitted'|'locked'`.
**SỰ KIỆN:** **Nhận:** `roomState` (đổi phase) · `answerLocked` (vào LOCKED) · `stationOpened` (STATION_OPEN→ sắp có câu) · `bossPhase({phase:"BOSS_INTRO"})` → biến thể cảnh báo bão (x2) · `roomState` khi host `revealAnswer`→(13a) / `showKnowledgeCard`→(12). **Phát:** `sendReaction` (tùy chọn).
**EDGE CASE:** nhận **phase chưa hỗ trợ** → `SyncScreen` "Đang đồng bộ…" (không crash, mục 4). Ở LOCKED mà chưa từng gửi → "Bạn chưa kịp trả lời" (không hoảng). Reconnect ở đây → khôi phục đúng nhánh.

---

## (12) Màn Lật Thẻ Tri Thức — `KnowledgeCardScreen`

**MỤC ĐÍCH:** Phase `KNOWLEDGE_CARD` — sau reveal, host mở "Thẻ Tri Thức" chốt kiến thức + `explain`. Khoảnh khắc "học được gì". Chỉ đến **sau reveal** (đúng luật vàng).

**WIREFRAME:**
```
┌────────────────────────────────────┐
│ 🧭 ABCD  [🟩 Rong Biển]  ⚡140  ●   │
│                                    │
│   ┌──────────────────────────┐     │
│   │  📜  THẺ TRI THỨC · Trạm③ │     │  ← flip animation
│   │  ──────────────────────── │     │
│   │  "Đặc trưng kinh tế thị   │     │  ← knowledgeCard.title
│   │   trường định hướng XHCN" │     │
│   │                          │     │
│   │  • Nhiều thành phần…      │     │  ← knowledgeCard.body
│   │  • Nhà nước điều tiết…    │     │
│   │                          │     │
│   │  💡 Vì sao: <explain>     │     │  ← explain
│   │  🏅 Huy hiệu: Nhà Kinh Tế │     │  ← badge (nếu có)
│   └──────────────────────────┘     │
├────────────────────────────────────┤
│   ⏳ Chờ giáo viên qua xếp hạng     │
└────────────────────────────────────┘
        😮 🔥 👏 😂
```

**COMPONENT:** `KnowledgeCardFlip` (Framer Motion flip, `--shadow-glow`), `CardTitle`, `CardBody`, `ExplainBlock`, `BadgeChip` (nếu `badge`), `ReactionBar`.
**STATE:** `knowledgeCard`, `explain` (từ payload). Chỉ đọc.
**SỰ KIỆN:** **Nhận:** `knowledgeCard({questionId, explain, knowledgeCard:{title,body,badge?,station}})` → render + flip · `roomState` (host `showLeaderboard`→(13b)). **Phát:** `sendReaction`.
**EDGE CASE:** `explain`/`badge` rỗng → ẩn khối tương ứng. `prefers-reduced-motion` → bỏ flip, hiện tĩnh. Vào muộn ngay KNOWLEDGE_CARD → render thẳng (không cần reveal trước đó trên UI). FALLBACK → hiện thẻ dạng text, bỏ flip.

---

## (13) Màn Kết quả cá nhân + Thứ hạng — `ResultScreen` (+ `LeaderboardScreen`, `VictoryScreen`, `EndedScreen`)

**MỤC ĐÍCH:** Cho SV biết **đúng/sai + điểm nhận (gồm tốc độ + combo, boss x2)** ở `REVEAL`/`BOSS_REVEAL` (13a), rồi **thứ hạng đội + tàu tiến** ở `LEADERBOARD` (13b), khép lại bằng `VICTORY` (13c) và `ENDED` (13d).

**WIREFRAME (13a — REVEAL, `yourResult`):**
```
┌────────────────────────────────────┐
│ 🧭 ABCD  [🟩 Rong Biển]  ⚡140  ●   │
│                                    │
│        🎉  CHÍNH XÁC! ✓            │  ← isCorrect (xanh)  /  ✗ SAI (đỏ)
│                                    │
│      +40 điểm                       │  ← pointsEarned (--text-4xl)
│      ⚡ Tốc độ  +12                 │  ← speedBonus
│      🔥 Combo  x3                   │  ← streak
│   ────────────────────────         │
│   Cả lớp đúng: 62%                  │  ← stats.classCorrectPct
│      (đáp án đúng: B)               │  ← từ answerRevealed.correct
├────────────────────────────────────┤
│   ⏳ Chờ Thẻ Tri Thức / xếp hạng    │
└────────────────────────────────────┘
```
**WIREFRAME (13b — LEADERBOARD, tàu tiến):**
```
│        🏁 BẢNG XẾP HẠNG            │
│  Bạn: hạng 4  · ⚡140  · 🔥3        │  ← players[].rank (của bạn)
│  ─── ĐỘI ───                        │
│  1.🟦 Lam Sóng Bạc      612  ▮▮▮▮▮▯ │  ← teams[].score + shipPositions.progress
│  2.🟩 Lục Rong Biển     588  ▮▮▮▮▯  │  ← đội bạn (nổi bật)
│  3.🟥 Hồng San Hô       540  ▮▮▮▯   │
│  ~~~ 🌊 bản đồ về cảng đích 🏁 ~~~   │
```
**WIREFRAME (13c — VICTORY / 13d — ENDED):**
```
│   🏆 VỀ CẢNG ĐÍCH!                  │   │  🙌 CẢM ƠN THỦY THỦ!            │
│   Vô địch: 🟦 Lam Sóng Bạc         │   │  Điểm của bạn: ⚡140  · hạng 4   │
│   Top: Minh Bão · Lan · Huy        │   │  Dân giàu·Nước mạnh·Dân chủ…    │
│   ⚡ Điểm bạn: 140                  │   │  (phòng đã đóng)                │
```

**COMPONENT:** `PersonalResultCard` (đúng/sai + `pointsEarned`/`speedBonus`/`streak`), `ClassStatBar` (`classCorrectPct`), `LeaderboardList` (đội + cá nhân, đội bạn nổi bật), `ShipProgressBar` (`shipPositions.progress` 0..1), `VictoryScene`, `EndedSummary`.
**STATE:** `yourResult{isCorrect,pointsEarned,speedBonus,streak}`, `score`, `streak`, `leaderboard{players,teams,shipPositions}`. Cập nhật `score/streak` toàn shell từ đây.
**SỰ KIỆN:** **Nhận:** `answerRevealed` (có `yourResult` riêng người đã trả lời → 13a) · `leaderboardUpdate({players,teams,shipPositions})` (13b) · `gameEnded({winnerTeam,topPlayers,finalTeams})` (13d) · `roomState` (VICTORY 13c). **Phát:** `sendReaction`.
**EDGE CASE:** không có `yourResult` (không trả lời) → hiện "Bạn bỏ lỡ câu này – +0"; không tụt tinh thần. Boss reveal → nhấn "điểm x2". `prefers-reduced-motion` → tàu tiến tĩnh. Reconnect ở REVEAL → server gửi lại `answerRevealed` để khôi phục kết quả. Ở `no-projector`, (13b) là màn chính hiển thị bản đồ trên điện thoại (mục 16).

---

## (14) Reaction / Emoji — `ReactionLayer` + `ReactionBar`

**MỤC ĐÍCH:** Chất Gen Z — thả emoji ("lật kèo", cổ vũ) ở các phase chờ/kết quả, **không cản trả lời** (mục 1.1). Bay realtime cho cả phòng.

**WIREFRAME (bar nổi + emoji bay):**
```
│            😂  ← emoji bay lên      │
│         🔥      👏                  │
├────────────────────────────────────┤
│      ( 😮 )( 🔥 )( 👏 )( 😂 )( ⚓ )  │  ← ReactionBar (tap = gửi)
```

**COMPONENT:** `ReactionBar` (hàng nút emoji, chống spam bằng throttle ~1/500ms), `FlyingEmoji` (animation bay + fade), `ReactionLayer` (lớp phủ toàn shell, `pointer-events:none` để không chặn nút thật).
**STATE:** `reactionCooldown`, hàng đợi emoji đang bay.
**SỰ KIỆN:** **Phát:** `sendReaction({ emoji })`. **Nhận:** `reactionBroadcast({ emoji, teamId, nickname? })` → sinh `FlyingEmoji` (tô viền `--team-{teamId}` nếu có).
**EDGE CASE:** **ẩn/khóa reaction khi `answerState ∈ {selecting, submitting}`** (đang trả lời — không cản thao tác). Trong `FALLBACK` → tắt emoji realtime (giảm tần suất, mục 5.4). Spam → throttle client + server bỏ bớt. `prefers-reduced-motion` → emoji hiện tĩnh/toast nhỏ thay vì bay.

---

## (15) Màn Mất kết nối / Đang reconnect — `ReconnectScreen` + `NetworkBanner`

**MỤC ĐÍCH:** "Chịu lỗi hiển thị được" (mục 1.1): báo mạng yếu/mất, **tự reconnect, giữ điểm, không mất tiến trình khi F5**. Là **overlay** đè mọi phase.

**WIREFRAME:**
```
┌────────────────────────────────────┐
│ ⚠ Mất kết nối – đang kết nối lại… ◐ │  ← NetworkBanner (dính top, --color-warning)
│                                    │
│         📡  Đang neo lại tàu…       │
│      Giữ nguyên máy, điểm của bạn   │
│      được lưu an toàn ⚡140          │
│        (thử lại lần 2…)            │
│                                    │
│   [    THỬ KẾT NỐI LẠI    ]         │  ← thủ công (dự phòng)
└────────────────────────────────────┘
```

**COMPONENT:** `NetworkBanner` (mạng yếu/mất, màu `--color-warning`→`--color-danger`), `ReconnectOverlay` (spinner + số lần thử + điểm giữ), `ManualRetryCta`.
**STATE:** `connected=false`, `reconnecting`, `retryCount`, giữ `reconnectToken/playerId/score` trong localStorage. `ConnectionBadge` ở shell chuyển `◐/○`.
**SỰ KIỆN:** **Phát:** `rejoin({ reconnectToken }, ack)` (tự động khi socket reconnect; hoặc `joinRoom` với `reconnectToken` nếu mất phiên). **Nhận:** `roomState` (khôi phục `phase/mode/currentQuestionId/serverNow`) + (nếu `ANSWERING`) `stationOpened` + `timerSync` → **khôi phục nguyên trạng câu hỏi & đồng hồ**, giữ điểm (mục 5.4) · `errorEvent{fatal}` (token hết hạn → quay (1)).
**EDGE CASE:** **F5 giữa lúc trả lời** → `rejoin` → nếu còn trong `deadlineTs` thì cho gửi tiếp; đã gửi rồi thì `submitAnswer` idempotent không cộng đôi. Deadline đã qua khi kết nối lại → vào LOCKED/REVEAL đúng thực tế. `reconnectToken` hỏng → `errorEvent.fatal` → về (1). Trong lúc mất mạng, host vẫn điều nhịp → khi nối lại chỉ nhận `roomState` mới nhất (không "tua lại" các phase đã qua).

---

## (16) Chế độ FALLBACK & "Không cần máy chiếu" trên điện thoại — `FallbackView` / `NoProjectorView`

**MỤC ĐÍCH:** Hai chế độ khẩn do **host bật** (`setMode`), phối cùng bất kỳ phase:
- **`FALLBACK`** (mạng lỗi): quiz **tối giản** — chỉ vòng hỏi–đáp–chấm, **tắt animation nặng/emoji realtime**, giảm tần suất (mục 5.4).
- **`no-projector`** (không máy chiếu): BIG SCREEN không có → **PLAYER tự render bản đồ hải trình + xếp hạng** từ `leaderboardUpdate` (mục 5.4).

**WIREFRAME (FALLBACK — ANSWERING tối giản):**
```
┌────────────────────────────────────┐
│ 🧭 ABCD  [🟩]  ⚡128   ● · chế độ nhẹ│  ← badge mode
│ ⚡ Chế độ tiết kiệm dữ liệu          │
│                          ⏱ 0:12    │  ← đồng hồ dạng số (bỏ Ring nặng)
│ Câu 3/? · Chọn 1 đáp án:            │
│  ( ) A. …   ( ) B. …                │  ← option phẳng, không animation
│  ( ) C. …   ( ) D. …                │
├────────────────────────────────────┤
│   [        GỬI ĐÁP ÁN         ]     │
└────────────────────────────────────┘
```
**WIREFRAME (no-projector — bản đồ trên điện thoại):**
```
│   🗺  HẢI TRÌNH (trên máy bạn)      │
│  1.🟦 Lam Sóng   612  ▮▮▮▮▮▯ Trạm③  │  ← shipPositions.progress + stationReached
│  2.🟩 Rong Biển  588  ▮▮▮▮▯  Trạm③  │
│  3.🟥 San Hô     540  ▮▮▮▯   Trạm②  │
│  ~~~ 🌊 về Cảng đích 🏁 ~~~          │
│  (máy chiếu tắt – xem tại đây)      │
```

**COMPONENT:** `ModeBadge` (hiện `mode` hiện tại), `FallbackChallenge` (renderer phẳng, dùng chung `RENDERERS` nhưng bỏ hiệu ứng), `NumericTimer` (thay `CountdownRing` khi FALLBACK), `NoProjectorMap` (`ShipProgressBar` + danh sách đội từ `leaderboardUpdate`).
**STATE:** `mode ∈ {lite|chuan|fallback|no-projector}` (từ `modeChanged`/`roomState.mode`). Khi `fallback` → cờ tắt animation/emoji; khi `no-projector` → bật `NoProjectorMap`.
**SỰ KIỆN:** **Nhận:** `modeChanged({ mode, reason? })` → chuyển view; `roomState.mode` (đồng bộ khi join/rejoin); vẫn nhận **cùng bộ event** (`stationOpened, timerSync, submitAnswer/answerAck, answerRevealed, leaderboardUpdate`) — chỉ giảm tần suất/hiệu ứng. **Phát:** `submitAnswer` như thường (`sendReaction` **tạm ẩn** trong FALLBACK).
**EDGE CASE:** đang FALLBACK, host `setMode('chuan')` → quay lại phase đang dở (server nhớ `resumePhase`), bật lại animation. `no-projector` + `FALLBACK` đồng thời → ưu tiên tối giản nhưng vẫn giữ bản đồ text. Reconnect trong mode khẩn → `roomState.mode` khôi phục đúng view. `prefers-reduced-motion` đã sẵn tương thích với FALLBACK (đều bỏ animation).

---

### Ghi chú điều phối (nhịp giáo viên) — áp cho toàn bộ màn player

- Player **không có nút "next"** ở các màn chờ/kết quả: mọi bước tiến do host (`openStation → startAnswering → lockAnswers → revealAnswer → showKnowledgeCard → showLeaderboard → nextStation/startBoss → … → endGame`). Player chỉ **phản ứng theo `roomState.phase`**.
- Chỉ 2 hành động player làm chủ động trong lúc chơi: **gửi đáp án** (`submitAnswer`, trong cửa sổ `ANSWERING/BOSS_ANSWERING` trước `deadlineTs`) và **reaction** (`sendReaction`).
- **`PAUSED`** có thể xảy ra bất kỳ lúc nào → `PausedOverlay` phủ mọi màn ("⏸ Thuyền trưởng tạm dừng"), giữ `deadlineTs`, chờ host `resumeGame`.
- **Phase lạ/chưa hỗ trợ** → luôn về `SyncScreen` an toàn, không crash (mục 4).
- Mọi màu/kích thước dùng **token** (mục 3): nền `var(--bg)`/`var(--surface)`, chữ `var(--text)`, primary `--color-primary-600`, đúng `--color-success`, sai `--color-danger`, boss `--color-boss`, đội `--team-{teamId}`; nút đáy `≥56px`, touch `≥44px`; bo `--radius-lg`; motion `--dur-fast/base/slow` + `--ease-out`.

---

# PHẦN C — GIAO DIỆN MÀN CHIẾU

## Giao diện MÀN CHIẾU (Big Screen — chiếu lên lớp)

> **Route:** `/present` · **Role socket:** `"screen"` · **Theme:** `data-theme="dark"` (biển đêm mặc định — mục 3.7) · **Thiết bị:** 1920×1080, xem cách 5–8m (10-foot UI).
> **Bản chất:** MÀN CHIẾU là **màn render thuần, READ-ONLY**. Nó **không emit** event nghiệp vụ nào ngoài `joinRoom({role:"screen"})` (+ `rejoin` khi mất kết nối). Mọi chuyển cảnh do **host** kích hoạt → server broadcast → màn chiếu render theo `roomState.phase`. Không có nút, không chạm, không bàn phím.
> **Nguồn phase duy nhất:** `roomState.phase` (mục 4). Component gốc `PresentRoot` là `switch(phase)` → chọn scene tương ứng.

### Quy ước chung toàn bộ MÀN CHIẾU (áp cho cả 10 màn)

- **Cỡ chữ tối thiểu tuyệt đối: `--text-2xl` = 24px** cho *bất kỳ* text nào hiện trên màn chiếu (nguyên tắc 1.2). Nhãn phụ/caption **không** dùng `--text-xs/sm/base` ở đây.
- **Tương phản ≥ 7:1**: nền `--color-bg-dark` (#071A2F) + chữ `--color-text-on-dark` (#E8F2FB). Font weight nội dung lớn **≥ `--fw-semibold` (600)**.
- **Đồng hồ**: mọi màn có timer đọc `timerSync.deadlineTs` + `clockOffset` (mục 5.4). MÀN CHIẾU **không** tự đếm ngược độc lập — tick UI 100ms rồi tính `remaining = deadlineTs - (Date.now()+clockOffset)`.
- **`prefers-reduced-motion`**: token `--dur-*` tự về 0ms (mục 3.7) → tắt sóng/parallax, giữ fade tối giản.
- **Mode**: nghe `modeChanged`. Nếu `mode === "no-projector"` → MÀN CHIẾU hiện overlay "Chế độ không máy chiếu — xem trên điện thoại" và ngừng là màn chính. Nếu `mode === "fallback"` → tắt toàn bộ animation nặng (sóng, hạt, tàu chạy), chỉ giữ layout tĩnh.
- **`PresentShell` (khung bọc mọi scene)**: 1 strip trên cùng cao 56px, chữ `--text-2xl`, luôn hiện: `⚓ tên game · MÃ PHÒNG (mono) · ● LIVE/RECONNECTING · connected/total`. Reconnect banner (`--color-warning`) khi socket rớt.
- Màn "đồng bộ…" an toàn (spinner + "Đang đồng bộ với phòng…") khi nhận `phase` chưa hỗ trợ (mục 4.2, chống crash).

---

### MÀN 1 — MÀN CHỜ (Lobby) + QR + Mã phòng + Danh sách người vào

**MỤC ĐÍCH:** Kéo SV vào phòng nhanh nhất — QR to + mã phòng khổng lồ + đếm số thủy thủ đã lên tàu tạo áp lực đám đông tích cực.
**PHASE:** `LOBBY`

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚓ HÀNH TRÌNH ĐỊNH HƯỚNG          MÃ PHÒNG: ABCD    ● LIVE   Đã vào 24/30    │ ← strip 24px
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   VƯỢT 5 TRẠM TRI THỨC                    ┌──────────────────────┐           │
│   ═══════════════════════  (72px)         │  ▓▓ ▓  ▓▓▓  ▓ ▓▓     │           │
│                                           │  ▓  ▓▓▓  ▓  ▓▓  ▓    │  QR       │
│   ①  Quét mã QR  →                        │  ▓▓  ▓ ▓▓▓  ▓  ▓▓    │  (≥380px) │
│   ②  Hoặc mở  play.tiximax.net/play       │  ▓ ▓▓▓  ▓  ▓▓▓ ▓     │           │
│   ③  Nhập MÃ PHÒNG:                        └──────────────────────┘           │
│                                                                              │
│        ┌────────────────────────┐                                            │
│        │    A  B  C  D          │  ← mono, 128px (--text-9xl), --accent-500  │
│        └────────────────────────┘                                            │
│                                                                              │
│ ── ⛵ Thủy thủ đã lên tàu (24) ───────────────────────────────────────────── │
│  🐙 Minh  🦈 Lan  🐡 Huy  🐳 An  🦑 Bình  🐠 Chi  🦀 Dũng  🐋 Hà  🐬 Khoa …  │ ← chip 28px, mới vào nảy vào
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `LobbyScene` › `RoomPinDisplay` (mono `--text-9xl`), `QrPoster` (QR do server/host cung cấp URL, render tĩnh), `JoinSteps`, `SailorGrid` (danh sách avatar+nickname), `LiveCount`.
**STATE (đều derive từ socket, read-only):** `roomCode`, `players[]`, `counts.total/connected` (từ `playerList`); `phase` (từ `roomState`).
**SỰ KIỆN NHẬN:** `roomState` (xác nhận `phase==="LOBBY"`), `playerList` (cập nhật lưới + đếm mỗi khi có người vào/rớt), `reactionBroadcast` (emoji chờ có thể bay ngẫu hứng), `modeChanged`, `errorEvent`.
**HIỆU ỨNG:** thủy thủ mới → chip **spring-in** (`--ease-out`, `--dur-base`) + sóng nhẹ chạy ngang đáy; số đếm `LiveCount` **count-up** khi tăng; QR có viền glow `--shadow-glow` nhẹ. Nền: sóng biển parallax chậm (tôn trọng reduced-motion).
**ĐỌC TỪ XA:** Mã phòng **128px mono** là điểm neo lớn nhất màn; QR ≥ 380px (quét được từ 5m); tên trạm 72px; chip thủy thủ **≥ 28px**. Không nhồi >~30 chip — tràn thì cuộn nhẹ/thu nhỏ theo số lượng nhưng không dưới 24px.

---

### MÀN 2 — GIỚI THIỆU HẢI TRÌNH + Bản đồ 5 trạm + Cảng đích

**MỤC ĐÍCH:** Cho lớp thấy toàn cảnh cuộc chơi: 4 trạm + 1 BOSS, đích đến là "Dân giàu – Nước mạnh – Dân chủ – Công bằng – Văn minh". Tạo tâm thế phiêu lưu.
**PHASE:** `INTRO`

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚓ HÀNH TRÌNH ĐỊNH HƯỚNG          MÃ PHÒNG: ABCD    ● LIVE   Đã vào 30/30    │
├────────────────────────────────────────────────────────────────────────────┤
│                    HẢI TRÌNH VƯỢT 5 TRẠM TRI THỨC   (60px)                   │
│                                                                              │
│   ⛵ XUẤT PHÁT                                                                │
│      \                                                                        │
│       ●─────────●─────────●─────────●────────≈≈≈≈≈≈────────★ CẢNG ĐÍCH        │
│    ①Đảo      ②Eo Biển   ③Quần Đảo  ④Cảng    🌪 BOSS      "Dân giàu–Nước      │
│    Khái Niệm  Tất Yếu   Đặc Trưng  Thể Chế  Cơn Bão      mạnh–Dân chủ–       │
│                                             NOXH (x2)    Công bằng–Văn minh"  │
│   ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌───────────┐              │
│   │🧭 Trạm 1 ││🌊 Trạm 2 ││🏝 Trạm 3 ││🏛 Trạm 4 ││🌪 BOSS x2 │              │
│   │Nhận biết ││Tất yếu   ││Đặc trưng ││Thể chế   ││Điểm nhân 2│              │
│   └──────────┘└──────────┘└──────────┘└──────────┘└───────────┘              │
│                                                                              │
│   Luật: Trả lời nhanh + đúng = điểm cao · Chuỗi đúng = combo · BOSS x2 điểm  │ ← 28px
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `IntroScene` › `VoyageMap` (đường hải trình 5 mốc + cảng đích), `StationLegendCard` ×5, `RulesRibbon`, `DestinationBanner` (cảng đích luôn cuối bản đồ — nguyên tắc 1.4).
**STATE:** tĩnh (danh sách trạm hằng số client, không có đáp án); chỉ `phase` từ `roomState`.
**SỰ KIỆN NHẬN:** `roomState` (`INTRO`), `modeChanged`, `errorEvent`. (Không có event dữ liệu riêng — màn giới thiệu thuần.)
**HIỆU ỨNG:** đường hải trình **vẽ nét chạy** trái→phải (path draw, `--dur-slow`); 5 thẻ trạm **stagger fade-up**; sao cảng đích lấp lánh `--color-accent-500` + `--shadow-glow`; con tàu ⛵ ở XUẤT PHÁT dập dềnh nhẹ.
**ĐỌC TỪ XA:** Tiêu đề 60px; tên trạm trên bản đồ **≥ 30px**; câu cảng đích nổi bật (accent) **≥ 30px**; ribbon luật **≥ 28px**. BOSS đánh dấu bằng `--color-boss` (#7C1D6F) + icon 🌪 để phân biệt rõ.

---

### MÀN 3 — CÂU HỎI CỦA TRẠM (chữ to, đồng hồ lớn, số người đã trả lời — KHÔNG lộ đáp án)

**MỤC ĐÍCH:** Chiếu **đề bài to** để cả lớp cùng đọc, đồng hồ khổng lồ tạo nhịp, đếm số người đã nộp tạo áp lực — **tuyệt đối không hiện đáp án đúng** (nguyên tắc bảo mật vàng).
**PHASE:** `STATION_OPEN` (chưa cho trả lời) → `ANSWERING` (timer chạy).

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🧭 TRẠM 1 · ĐẢO KHÁI NIỆM        Câu 2/5 · Nhận biết · MCQ      ● LIVE       │ ← 28px
├────────────────────────────────────────────────────────────────────────────┤
│                                                          ┌───────────────┐   │
│                                                          │      18       │   │ ← 128px
│   Định hướng XHCN ở Việt Nam về                          │  ─────────    │   │ (đồng hồ)
│   bản chất KHÔNG bao gồm nội dung                        │    GIÂY       │   │
│   nào sau đây?                                           └───────────────┘   │
│                        (prompt 48px, ≤3 dòng)             ▓▓▓▓▓▓▓▓░░░░ 62%    │ ← vòng/thanh
│                                                                              │
│   Ⓐ  ●●●●●●          Ⓑ  ●●●●●●                                               │
│                                                                              │
│   Ⓒ  ●●●●●●          Ⓓ  ●●●●●●     (4 ô TRUNG TÍNH — chỉ nhãn A/B/C/D,       │
│                                     KHÔNG hiện chữ đáp án chi tiết)           │
│                                                                              │
│ ── 📱 Đọc chi tiết & chọn trên điện thoại ────────────────────────────────── │
│    ✅ Đã trả lời:  22 / 30            ████████████████░░░░░░░  (73%)           │ ← 36px
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `QuestionScene` › `StationHeader`, `BigPrompt` (đọc `question.prompt`), `BigTimer` (vòng tròn/số `--text-9xl`), `OptionSlots` (chỉ nhãn A/B/C/D hoặc số lượng — **không** text option, theo mục 6 "BIG SCREEN đọc từ xa"), `AnsweredProgress` (đọc `answerLocked.answeredCount`… xem lưu ý), `TypeHintChip` ("Chọn cái SAI" nếu `selectwrong`, badge "x2" nếu boss).
**STATE:** `question: PublicQuestion` (từ `stationOpened` — **đã lược đáp án**), `deadlineTs/serverNow/durationSec` (từ `timerSync`), `answeredCount/totalPlayers`, `remaining` (derived tick). **Không tồn tại** trường `correct` ở màn này.
**SỰ KIỆN NHẬN:** `stationOpened` (render đề, phân biệt `STATION_OPEN` vs `ANSWERING`), `timerSync` (mốc deadline tuyệt đối — nguồn hết giờ thật), `answerLocked` (số đã trả lời + tổng — dùng cập nhật live counter; `reactionBroadcast` (emoji bay), `roomState`, `modeChanged`, `errorEvent`.
> *Lưu ý số đã trả lời live:* nếu cần đếm tăng dần trước khi khóa, dùng `answerLocked.answeredCount`/`playerList.counts` làm nguồn; **không** suy ra từ đáp án (màn chiếu không nhận `submitAnswer`).
**HIỆU ỨNG:** `BigTimer` vòng tròn thu dần; **≤ 10s** đổi sang `--color-warning`, **≤ 5s** đỏ `--color-danger` + pulse + rung nhẹ; thanh "đã trả lời" **fill mượt**; khi từng người nộp → tick +1 nảy nhẹ. Boss: nền phủ `--color-boss`, badge "x2" glow.
**ĐỌC TỪ XA:** **Prompt ≥ 48px** (`--text-5xl`), tối đa 3 dòng, canh trái; **đồng hồ 128px** (`--text-9xl`) — điểm neo mạnh nhất; header/meta **≥ 28px**; dòng "Đã trả lời X/Y" **≥ 36px**. Với `dragdrop/matching` → hiện **tên bucket + đếm đội đã nộp** thay vì chi tiết item (mục 6).

---

### MÀN 4 — REVEAL: Đáp án đúng + bảng đồ % lớp chọn mỗi phương án

**MỤC ĐÍCH:** Công bố đáp án đúng, cho lớp thấy phân bố lựa chọn (bao nhiêu % chọn đúng/sai) — khoảnh khắc "à ra thế". Chỉ vào được sau khi host `revealAnswer`.
**PHASE:** `REVEAL` (và `BOSS_REVEAL`).

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🧭 TRẠM 1 · ĐẢO KHÁI NIỆM        Câu 2/5 · ĐÁP ÁN            ● LIVE           │
├────────────────────────────────────────────────────────────────────────────┤
│   Định hướng XHCN ở Việt Nam về bản chất KHÔNG bao gồm…    (prompt 36px)      │
│                                                                              │
│   ✔ ĐÁP ÁN ĐÚNG:  Ⓒ  "Phát triển kinh tế thị trường tự do tuyệt đối"          │ ← 48px, --success
│                                                                              │
│   Cả lớp chọn:                                                                │
│   Ⓐ ████████░░░░░░░░░░░░░░░░  22%                                             │
│   Ⓑ ██████░░░░░░░░░░░░░░░░░░  15%                                             │
│   Ⓒ ██████████████████████░  58%  ✔  ← xanh --success, có glow               │
│   Ⓓ ██░░░░░░░░░░░░░░░░░░░░░░   5%   ✘  ← đỏ --danger                          │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  🎯 Cả lớp trả lời ĐÚNG: 58%           Trạm 1 · Câu 2               │    │ ← 36px
│   └────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `RevealScene` › `CorrectAnswerBanner` (đọc `answerRevealed.correct`), `AnswerDistributionChart` (thanh ngang từ `stats.optionPct`), `ClassCorrectRate` (`stats.classCorrectPct`). Với `truefalse` → tô từng `statementId` theo `stats.statementCorrectPct`; với `dragdrop/matching` → tô từng `itemId`/bucket theo `stats.bucketCorrectPct` (mục 6).
**STATE:** `correct` + `stats` (từ `answerRevealed`), `question` (giữ lại từ `stationOpened` để dựng nhãn). **Đây là màn ĐẦU TIÊN màn chiếu được biết đáp án đúng.**
**SỰ KIỆN NHẬN:** `answerRevealed` (nguồn chính — đáp án + %), `roomState` (`REVEAL`/`BOSS_REVEAL`), `bossPhase` (nếu boss → hiện multiplier), `reactionBroadcast`, `modeChanged`, `errorEvent`.
**HIỆU ỨNG:** thanh % **grow từ 0** (`--dur-slow`); cột đúng Ⓒ **highlight** `--color-success` + `--shadow-glow` + dấu ✔ nảy; cột đông người chọn nhưng sai → nhấp đỏ nhẹ; `ClassCorrectRate` count-up %. Boss reveal: hiệu ứng bão dịu lại, badge "x2" trên điểm.
**ĐỌC TỪ XA:** Banner đáp án đúng **≥ 48px** màu `--color-success`; nhãn A/B/C/D + % **≥ 36px**; % chọn in đậm; dùng **cả màu + icon ✔/✘** (không chỉ màu) để hỗ trợ mù màu. Prompt rút gọn còn ~36px (không cần đọc lại kỹ).

---

### MÀN 5 — LẬT THẺ TRI THỨC (hiệu ứng mở rương)

**MỤC ĐÍCH:** Chốt kiến thức cốt lõi sau mỗi câu bằng "Thẻ Tri Thức" + `explain` — biến chấm điểm thành khoảnh khắc học. Vào sau host `showKnowledgeCard`.
**PHASE:** `KNOWLEDGE_CARD`

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🧭 TRẠM 1 · ĐẢO KHÁI NIỆM              THẺ TRI THỨC              ● LIVE       │
├────────────────────────────────────────────────────────────────────────────┤
│                        ✨  ┏━━━━━━━━━━━━━━━━━┓  ✨                            │
│                            ┃   RƯƠNG MỞ...   ┃      (rương → thẻ bay ra)      │
│                        ✨  ┗━━━━━━━━━━━━━━━━━┛  ✨                            │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  🏅 THẺ TRI THỨC #2            [ Huy hiệu: NHÀ HÀNG HẢI KHÁI NIỆM ]    │  │
│   │  ────────────────────────────────────────────────────────────────    │  │
│   │  “Định hướng XHCN là con đường phát triển bỏ qua chế độ TBCN…”         │  │ ← title 48px
│   │                                                                        │  │
│   │  Vì sao: Kinh tế thị trường định hướng XHCN vẫn có nhiều thành phần    │  │ ← body 30px
│   │  kinh tế, nhưng nhà nước giữ vai trò định hướng… (explain đầy đủ)       │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                        Trạm 1 · Thẻ 2/5 đã sưu tầm ✦✦○○○                      │ ← 28px
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `KnowledgeCardScene` › `TreasureChest` (animation mở rương), `KnowledgeCardPanel` (`knowledgeCard.title/body` + `explain`), `CardBadge` (`knowledgeCard.badge`), `CollectionTracker` (đã sưu tầm bao nhiêu/5 — dựa `knowledgeCard.station`).
**STATE:** `knowledgeCard{title,body,badge,station}` + `explain` (từ `knowledgeCard`); đếm số thẻ đã lật (client tích lũy theo station đã đi qua).
**SỰ KIỆN NHẬN:** `knowledgeCard` (nguồn chính — đến **sau** reveal, chứa `explain`), `roomState` (`KNOWLEDGE_CARD`), `reactionBroadcast`, `modeChanged`, `errorEvent`.
**HIỆU ỨNG:** **Mở rương**: nắp rương bật lên + tia sáng `--color-accent-500` tỏa (`--shadow-glow`), thẻ **flip 3D** bay ra và phóng to (`--ease-out`, ~0.8–1.2s theo giới hạn 1.2s mục 1.2), hạt vàng lấp lánh; huy hiệu **stamp** đóng dấu. Reduced-motion → thẻ fade-in tĩnh, không rương bay.
**ĐỌC TỪ XA:** Title thẻ **≥ 48px**, body/explain **≥ 30px** (dài nên cho phép 30px nhưng không dưới 24px), tối đa ~4 dòng; huy hiệu + tracker **≥ 28px**. Nền tối, thẻ nổi trên `--color-surface-dark` viền accent.

---

### MÀN 6 — BẢN ĐỒ ĐUA TÀU: vị trí tàu các đội tiến về cảng

**MỤC ĐÍCH:** Trực quan hóa cuộc đua 6 đội bằng vị trí tàu trên hải trình — nhìn phát biết đội nào dẫn, ai sắp cập bến. Đây là "mặt tiền" cảm xúc của trò chơi.
**PHASE:** thành phần của `LEADERBOARD` (map view) — dùng `leaderboardUpdate.shipPositions`.

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🗺 BẢN ĐỒ HẢI TRÌNH · SAU TRẠM 3            ● LIVE            Mã: ABCD         │
├────────────────────────────────────────────────────────────────────────────┤
│  XUẤT PHÁT   ①Khái Niệm  ②Tất Yếu  ③Đặc Trưng  ④Thể Chế  🌪BOSS  ★ CẢNG ĐÍCH  │
│  │            │           │          │           │        │       │          │
│  ●──────────╍╍●╍╍╍╍╍╍╍╍╍╍╍●╍╍╍╍╍╍╍╍╍╍╍⛵───────────┼────────┼───────┤  Hồng SH │ team-1
│  ●──────────╍╍●╍╍╍╍╍╍╍╍╍╍╍⛵──────────┼───────────┼────────┼───────┤  Cam HĐ  │ team-2
│  ●──────────╍╍●╍╍╍╍╍╍⛵────┼──────────┼───────────┼────────┼───────┤  Vàng CB │ team-3
│  ●──────────╍╍⛵╍╍╍╍╍╍╍╍╍╍╍●╍╍╍╍╍╍╍╍╍╍╍●────────────┼───────┼───────┤  Lục RB  │ team-4
│  ●──────────╍╍●╍╍╍╍╍╍╍╍╍╍╍●╍╍╍╍╍╍╍╍⛵──┼───────────┼────────┼───────┤  Lam SB  │ team-5
│  ●──────────╍╍●╍╍╍╍╍╍╍╍╍⛵─┼──────────┼───────────┼────────┼───────┤  Tím HV  │ team-6
│                                                                              │
│  🥇 Hồng San Hô dẫn đầu — sắp tới Cảng Thể Chế!            (banner 36px)      │
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `RaceMapScene` › `VoyageTrack` (6 làn + 5 mốc trạm + cảng đích), `TeamShip` ×6 (màu `--team-{n}` theo `teamId`), `LeaderCallout`, `StationGates`. Cảng đích luôn cuối (nguyên tắc 1.4).
**STATE:** `shipPositions[{teamId, progress(0..1), stationReached}]`, `teams[]` (từ `leaderboardUpdate`); vị trí trước đó (để animate từ cũ → mới).
**SỰ KIỆN NHẬN:** `leaderboardUpdate` (nguồn chính — `shipPositions` + `teams`), `roomState` (`LEADERBOARD`), `reactionBroadcast`, `modeChanged` (nếu `no-projector`, PLAYER tự render map thay màn chiếu — mục 5.4), `errorEvent`.
**HIỆU ỨNG:** tàu **trượt mượt** từ `progress` cũ → mới (`--ease-out`, `--dur-slow`), để lại vệt sóng; đội vượt lên → tàu **nhảy hạng** kèm sparkle; đội dẫn đầu có cờ 🥇 + glow; khi tàu chạm mốc trạm → cổng trạm sáng. Reduced-motion → tàu nhảy vị trí không trượt.
**ĐỌC TỪ XA:** Tên trạm trên trục **≥ 28px**; nhãn đội cuối làn **≥ 30px** kèm màu `--team-{n}` (6 hue cách đều — phân biệt cả từ xa & mù màu, mục 3.2); callout dẫn đầu **≥ 36px**. Tàu vẽ đủ to (≥ 48px icon) để thấy rõ ở 8m.

---

### MÀN 7 — LEADERBOARD cá nhân + đội, khoảnh khắc "lật kèo" phóng to

**MỤC ĐÍCH:** Bảng xếp hạng **kép** (cá nhân + đội) sau mỗi vòng; làm nổi bật khoảnh khắc thứ hạng đảo chiều ("lật kèo") để tạo kịch tính.
**PHASE:** `LEADERBOARD`

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🏆 BẢNG XẾP HẠNG · SAU TRẠM 3                ● LIVE               Mã: ABCD    │
├────────────────────────────────────────────────────────────────────────────┤
│   XẾP HẠNG ĐỘI                    │   TOP THỦY THỦ                            │
│  ┌──────────────────────────────┐ │  ┌──────────────────────────────────┐   │
│  │🥇 Hồng San Hô      ▲  4 820   │ │  │ 1  🐙 Minh   (Hồng SH)     1 640  │   │ ← 48px điểm
│  │🥈 Lam Sóng Bạc     ▲  4 510   │ │  │ 2  🦈 Lan    (Lam SB)      1 580  │   │
│  │🥉 Cam Hải Đăng     ▼  4 190   │ │  │ 3  🐳 An     (Cam HĐ)      1 450  │   │
│  │ 4 Lục Rong Biển    ▲  3 900   │ │  │ 4  🦑 Bình   (Lục RB)      1 390  │   │
│  │ 5 Vàng Cánh Buồm   ▼  3 640   │ │  │ 5  🐡 Huy    (Vàng CB) 🔥x4 1 280 │   │
│  │ 6 Tím Hải Vương       3 210   │ │  └──────────────────────────────────┘   │
│  └──────────────────────────────┘ │                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  ⚡ LẬT KÈO!  Lam Sóng Bạc vượt Cam Hải Đăng lên hạng 2!  (+ nhảy cỡ)  │  │ ← overlay 60px
│   └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `LeaderboardScene` › `TeamRankTable` (`teams[]`), `PlayerRankTable` (`players[]` top N), `RankDeltaArrow` (▲/▼ so hạng trước), `StreakBadge` (`🔥x{streak}` từ `players[].streak`), `ComebackOverlay` ("lật kèo").
**STATE:** `teams[]`, `players[]` (điểm/streak/rank từ `leaderboardUpdate`); **snapshot hạng trước** (client giữ để tính delta & phát hiện vượt hạng → trigger overlay lật kèo).
**SỰ KIỆN NHẬN:** `leaderboardUpdate` (nguồn chính), `roomState` (`LEADERBOARD`), `reactionBroadcast`, `modeChanged`, `errorEvent`.
**HIỆU ỨNG:** hàng **FLIP reorder** (đo vị trí cũ→mới, trượt mượt `--ease-out`); mũi tên ▲ xanh `--success` / ▼ đỏ `--danger`; điểm **count-up**; khi phát hiện đội/người **vượt hạng** → `ComebackOverlay` **phóng to giữa màn** + zoom pulse + tia accent + (tùy) âm báo, giữ ~1.2s rồi thu về hàng. `🔥` streak nhấp nháy accent.
**ĐỌC TỪ XA:** Tên đội/thủy thủ **≥ 36px**, điểm **≥ 48px** in đậm (`--fw-bold`); chấm màu `--team-{n}` cạnh tên; overlay lật kèo **≥ 60px**. Chỉ hiển thị **Top ~5–6** cá nhân để chữ đủ lớn (không list cả 30).

---

### MÀN 8 — BOSS: hiệu ứng sóng bão, điểm x2

**MỤC ĐÍCH:** Đẩy cao trào — "Cơn Bão Nhà Ở Xã Hội" với điểm **x2**, không khí căng thẳng khác hẳn trạm thường, đây là câu quyết định thứ hạng.
**PHASE:** `BOSS_INTRO` → `BOSS_ANSWERING` (→ `BOSS_REVEAL` dùng lại MÀN 4 với badge x2).

**WIREFRAME — BOSS_INTRO (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│  🌪🌊 ~~~~~~ CƠN BÃO ~~~~~~ 🌊🌪            ● LIVE            (nền --boss tím)  │
├────────────────────────────────────────────────────────────────────────────┤
│   ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈       │
│                                                                              │
│               🌪  CƠN BÃO NHÀ Ở XÃ HỘI  🌪        (72px, --text-7xl)         │
│                                                                              │
│                      ┌────────────────────┐                                  │
│                      │      ĐIỂM  × 2      │   ← 96px, --accent-500 glow      │
│                      └────────────────────┘                                  │
│               Trận BOSS quyết định — trả lời đúng nhân đôi điểm!              │ ← 36px
│                                                                              │
│   ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈  ⛴ tàu chòng chành  ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈       │
└────────────────────────────────────────────────────────────────────────────┘
```
**BOSS_ANSWERING:** dùng layout **MÀN 3** nhưng phủ theme bão: nền `--color-boss`, sóng động mạnh hơn, badge **"x2"** cạnh đồng hồ, đề bài giữ nguyên quy tắc *không lộ đáp án*.

**COMPONENT:** `BossIntroScene` › `StormBackdrop` (sóng+mây bão), `BossTitle` (`bossPhase.title`), `MultiplierBadge` (`bossPhase.pointsMultiplier` → "x2"), `BossWarningText`. Khi answering: tái dùng `QuestionScene` + `bossTheme`.
**STATE:** `phase`, `pointsMultiplier`, `title` (từ `bossPhase`); ở answering thêm `question` (`stationOpened`, `station:"boss"`) + `timerSync`. `question.pointsMultiplier` cũng có trong payload (mục 6) → hiện badge x2.
**SỰ KIỆN NHẬN:** `bossPhase` (nguồn chính — phân biệt `BOSS_INTRO`/`BOSS_ANSWERING`/`BOSS_REVEAL` + multiplier), `stationOpened` (đề boss, đã lược đáp án), `timerSync`, `answerLocked`, `answerRevealed` (cho `BOSS_REVEAL`), `roomState`, `reactionBroadcast`, `modeChanged`, `errorEvent`.
**HIỆU ỨNG:** vào boss → **chớp sét + rung màn** ngắn, nền chuyển sang `--color-boss`; sóng biên độ lớn, mây bão trôi, tàu chòng chành; badge **"×2" phóng to + glow** `--shadow-glow`; đồng hồ boss màu cảnh báo sớm hơn. **fallback/reduced-motion** → bỏ rung/sét, giữ nền tím tĩnh + badge x2.
**ĐỌC TỪ XA:** Tiêu đề BOSS **72px** (`--text-7xl`), badge "×2" **96px** (`--text-8xl`) — phải đọc rõ đây là câu nhân đôi; cảnh báo **≥ 36px**. Dùng màu `--color-boss` nhất quán với bản đồ (MÀN 2/6) để lớp nhận ra "đã tới BOSS".

---

### MÀN 9 — CẬP BẾN / VÔ ĐỊCH + huy hiệu

**MỤC ĐÍCH:** Đỉnh cảm xúc cuối — tàu đội vô địch cập "Cảng đích", công bố đội vô địch + top thủy thủ + trao huy hiệu. Đóng lại hành trình.
**PHASE:** `VICTORY` (tàu về cảng) → `ENDED` (tổng kết đóng phòng) — dùng `gameEnded`.

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│  🎉🎊  CẬP BẾN CẢNG ĐÍCH — VÔ ĐỊCH!  🎊🎉        (pháo hoa, --accent glow)   │
├────────────────────────────────────────────────────────────────────────────┤
│                        ★  DÂN GIÀU · NƯỚC MẠNH · DÂN CHỦ                      │
│                           CÔNG BẰNG · VĂN MINH  ★         (36px cảng đích)    │
│                                                                              │
│                       ⛵ ➜ ★                                                  │
│                 ┌────────────────────────────┐                               │
│                 │   🥇  ĐỘI VÔ ĐỊCH           │                               │
│                 │   ██ HỒNG SAN HÔ ██         │  ← 72px, viền --team-1        │
│                 │        5 640 điểm           │  ← 96px --text-8xl            │
│                 │   🏅🏅🏅🏅🏅 (5 huy hiệu)     │                               │
│                 └────────────────────────────┘                               │
│   🥈 Lam Sóng Bạc 5 210     🥉 Cam Hải Đăng 4 980                            │ ← 36px
│   👑 MVP: 🐙 Minh — 1 980 điểm · chuỗi đúng 7 🔥                              │ ← 36px
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `VictoryScene` › `ChampionCard` (`gameEnded.winnerTeam`, màu `--team-{n}`), `DestinationBanner` (cảng đích), `PodiumRunnersUp` (`finalTeams` top 2–3), `MvpCard` (`topPlayers[0]`), `BadgeShowcase` (huy hiệu 5 trạm), `Confetti`.
**STATE:** `winnerTeam`, `topPlayers[]`, `finalTeams[]` (từ `gameEnded`); huy hiệu sưu tầm (client tích lũy từ các `knowledgeCard.badge`).
**SỰ KIỆN NHẬN:** `gameEnded` (nguồn chính), `roomState` (`VICTORY`/`ENDED`), `reactionBroadcast` (emoji ăn mừng bay), `modeChanged`, `errorEvent`.
**HIỆU ỨNG:** tàu vô địch **trượt vào cảng** ⛵➜★ + neo đậu; **pháo hoa/confetti** màu đội vô địch + accent; `ChampionCard` **zoom-in spring** + `--shadow-glow`; 5 huy hiệu **stamp lần lượt**; MVP card fade-up. Reduced-motion → bỏ confetti/pháo, giữ zoom nhẹ + tĩnh.
**ĐỌC TỪ XA:** Tên đội vô địch **72px**, điểm **96px** (`--text-8xl`); banner cảng đích **≥ 36px** (đúng nguyên tắc 1.4 — luôn là đích cuối); á quân/MVP **≥ 36px**. Màu champion card = `--team-{n}` của đội thắng để lớp nhận ngay.

---

### MÀN 10 — TỔNG KẾT 5 THẺ TRI THỨC

**MỤC ĐÍCH:** Ôn lại **toàn bộ tri thức cốt lõi** của 4 trạm + BOSS trong 1 màn — chốt bài học sau khi cảm xúc lên đỉnh. "Bộ sưu tập hoàn chỉnh".
**PHASE:** thành phần cuối của `VICTORY`/`ENDED` (gallery các `knowledgeCard` đã lật).

**WIREFRAME (16:9):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📚 BỘ SƯU TẬP 5 THẺ TRI THỨC — HÀNH TRANG VỀ CẢNG        ● LIVE   Mã: ABCD   │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │🏅 THẺ 1      │ │🏅 THẺ 2      │ │🏅 THẺ 3      │ │🏅 THẺ 4      │         │
│  │Đảo Khái Niệm │ │Eo Tất Yếu    │ │Quần Đảo ĐT   │ │Cảng Thể Chế  │         │
│  │──────────────│ │──────────────│ │──────────────│ │──────────────│         │
│  │Định hướng    │ │Kinh tế thị   │ │3 đặc trưng   │ │Nhà nước pháp │         │ ← title 30px
│  │XHCN là…      │ │trường tất…   │ │cơ bản…       │ │quyền XHCN…   │         │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│                         ┌────────────────────┐                               │
│                         │🌪 THẺ BOSS          │                               │
│                         │Nhà Ở Xã Hội        │  ← viền --color-boss           │
│                         │Chính sách an sinh… │                               │
│                         └────────────────────┘                               │
│              ✦ Đã sưu tầm đủ 5/5 Thẻ Tri Thức — Cảm ơn hành trình! ✦          │ ← 36px
└────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT:** `KnowledgeSummaryScene` › `CardGallery` (grid 4 trạm + 1 BOSS), `SummaryCardTile` ×5 (title + tóm tắt body, badge, màu theo station; BOSS viền `--color-boss`), `CollectionComplete` (5/5).
**STATE:** `collectedCards[]` — client tích lũy từ mọi `knowledgeCard` nhận suốt ván (title/body/badge/station). Không cần event mới.
**SỰ KIỆN NHẬN:** không có event riêng — dựng từ **kho `knowledgeCard` đã nhận** trong phiên; nghe `roomState` (`VICTORY`/`ENDED`), `modeChanged`, `errorEvent`. (Nếu reconnect muộn, `roomState`/snapshot khôi phục; thẻ thiếu hiện placeholder "Ô chưa lật".)
**HIỆU ỨNG:** 5 thẻ **bay vào & lật lần lượt** (stagger flip, mỗi thẻ cách `--dur-fast`); thẻ hoàn tất phát glow accent; dòng "5/5" **stamp** khi thẻ cuối lật xong. Reduced-motion → hiện grid tĩnh, không lật.
**ĐỌC TỪ XA:** Tiêu đề màn **≥ 48px**; title mỗi thẻ **≥ 30px**, tóm tắt body **≥ 28px** (rút gọn 1–2 dòng, không dồn cả `explain` — chi tiết đã ở MÀN 5); thẻ BOSS dùng `--color-boss` để nổi bật. Grid tối đa 5 thẻ nên chữ luôn đủ lớn ở 8m.

---

### Ma trận Phase → Scene (chốt cho routing nội bộ `PresentRoot`)

| `roomState.phase` | Scene MÀN CHIẾU | Event dữ liệu chính |
|---|---|---|
| `LOBBY` | MÀN 1 Lobby | `playerList` |
| `INTRO` | MÀN 2 Hải trình | — (tĩnh) |
| `STATION_OPEN` / `ANSWERING` | MÀN 3 Câu hỏi | `stationOpened`, `timerSync`, `answerLocked` |
| `LOCKED` | MÀN 3 (khóa, "Đã hết giờ / đang chấm") | `answerLocked` |
| `REVEAL` | MÀN 4 Reveal | `answerRevealed` |
| `KNOWLEDGE_CARD` | MÀN 5 Thẻ Tri Thức | `knowledgeCard` |
| `LEADERBOARD` | MÀN 6 Bản đồ đua + MÀN 7 BXH (tab/tuần tự do host điều nhịp) | `leaderboardUpdate` |
| `BOSS_INTRO` / `BOSS_ANSWERING` | MÀN 8 Boss | `bossPhase`, `stationOpened`, `timerSync` |
| `BOSS_REVEAL` | MÀN 4 (badge x2) | `answerRevealed`, `bossPhase` |
| `VICTORY` | MÀN 9 Vô địch → MÀN 10 Tổng kết thẻ | `gameEnded` |
| `ENDED` | MÀN 10 (giữ) / "Cảm ơn" | `gameEnded` |
| `PAUSED` | Overlay "Tạm dừng ⏸" đè scene hiện tại (giữ `resumePhase`) | `roomState` |
| `FALLBACK` | Scene tương ứng nhưng tắt animation nặng | `modeChanged` |

> Toàn bộ tên **phase / event / token / team** trong mục này trích **nguyên văn** từ NỀN TẢNG v1.0 (mục 3–6). Không đặt biến thể mới; mọi thay đổi phải cập nhật NỀN TẢNG trước.

---

# PHẦN D — GIAO DIỆN CONSOLE GIÁO VIÊN

## Giao diện CONSOLE GIÁO VIÊN (Host)

> **Route:** `/host` · **role socket:** `"host"` (server kiểm `hostToken`) · **Thiết bị:** laptop/desktop ngang, tối thiểu breakpoint `lg` (≥1024px), tối ưu `xl` (≥1280px).
> **Theme:** alias sáng mặc định (mục 3.7 — `--bg:var(--color-bg-light)`), **KHÔNG** gắn `data-theme="dark"` (dark chỉ dành `/present`).
> **Triết lý (mục 1.3):** mật độ control cao, luôn thấy "đang ở state nào", deadline, mode, số kết nối; mọi hành động bất khả hồi có xác nhận; host là **bên duy nhất điều khiển state machine** (client khác chỉ render theo `roomState.phase`).
> **Ràng buộc vàng đã tuân thủ:** host phát event C→S (mục 5.2), lắng nghe S→C (mục 5.3); timer đọc từ `timerSync.deadlineTs` + `clockOffset` (mục 5.4), không tự đếm.

---

### H.0. Khung vỏ cố định (App Shell) — luôn hiển thị mọi phase

**MỤC ĐÍCH:** giữ 3 dải điều khiển bất biến quanh vùng nội dung để host không bao giờ mất ngữ cảnh: **thanh trạng thái (trên)**, **lưới 3 cột (giữa)**, **thanh cứu hộ + hiệu ứng (dưới)**.

**WIREFRAME ASCII (1280×800, tỉ lệ thật của laptop):**

```
┌════════════════════════════════════════ THANH TRẠNG THÁI (fixed-top) ════════════════════════════════════════┐
│ ⚓ HẢI TRÌNH·HOST   PIN 7F3K [QR▾]   ●ANSWERING   ◈mode:CHUAN   ⏱00:23 ▓▓▓▓▓░░  👥27/30  ✅21/27  🔌socket●  │
└═══════════════════════════════════════════════════════════════════════════════════════════════════════════════┘
┌──────── CỘT TRÁI (24%) ────────┬──────────── CỘT GIỮA (48%) ─────────────┬───────── CỘT PHẢI (28%) ──────────┐
│ HẢI TRÌNH / TIẾN ĐỘ            │  BẢNG ĐIỀU PHỐI + XEM TRƯỚC (host-only)  │  MÀN ĐANG PHÁT (mirror) / ROSTER   │
│ ┌───────────────────────────┐ │ ┌──────────────────────────────────────┐ │ ┌────────────────────────────────┐ │
│ │ ●Trạm1 Đảo Khái Niệm  ✔   │ │ │  [ CTA CHÍNH THEO PHASE ]            │ │ │  Live: 21/27 đã trả lời        │ │
│ │ ●Trạm2 Eo Biển Tất Yếu ▶  │ │ │  Q2.3 · mcq · van_dung · ⏱30s       │ │ │  Đội: 🟥6 🟧5 🟨4 🟩4 🟦4 🟪4  │ │
│ │ ○Trạm3 Quần Đảo Đặc Trưng │ │ │  Prompt + đáp án ĐÚNG (chỉ host)     │ │ │  ▓▓▓▓▓▓▓░░ 78%                  │ │
│ │ ○Trạm4 Cảng Thể Chế       │ │ │  ────────────────────────────────    │ │ ├────────────────────────────────┤ │
│ │ ⛈ BOSS  Bão NOXH  ×2      │ │ │  [Mở][Bắt đầu][Khóa][Chốt][Thẻ][Rank]│ │ │  BẢNG ĐO FORMATIVE (rút gọn)   │ │
│ │ 🏁 Cảng: Dân giàu…Văn minh │ │ │  ⏲ ĐIỀU TIẾT THỜI GIAN               │ │ │  Trạm1 84% ✓ · Trạm2 61% ⚠     │ │
│ └───────────────────────────┘ │ └──────────────────────────────────────┘ │ └────────────────────────────────┘ │
└────────────────────────────────┴──────────────────────────────────────────┴────────────────────────────────────┘
┌════════════════════ THANH CỨU HỘ + HIỆU ỨNG (fixed-bottom) ══════════════════════════════════════════════════┐
│ [⏸ Tạm dừng] │ [⏭ Bỏ câu*] [↺ Chơi lại*] │ [⚡ FALLBACK] [📵 Không máy chiếu] │ [🎵Nhạc*][😊React*][⛈Boss] │[⛔ Kết thúc]│
└═══════════════════════════════════════════════════════════════════════════════════════════════════════════════┘
   * = event chưa có trong hợp đồng mục 5 → xem "Ghi chú lệch hợp đồng" cuối tài liệu.
```

**COMPONENT / control (shell):**
- `HostTopBar` — hiển thị `roomCode` (font `--font-mono`), nút `QR▾` (popover), **PhaseBadge**, **ModeBadge**, **DeadlineMeter**, **ConnBadge**, **AnsweredBadge**, **SocketHealthDot**.
- `HostGrid` — lưới 3 cột (`grid-cols-[24%_48%_28%]`, gap `--space-4`); cột giữa cuộn dọc, 2 cột bên `sticky`.
- `EmergencyBar` — footer cố định, nhóm nút cứu hộ + hiệu ứng.
- `ConfirmDialog` (dùng chung) — modal chặn cho hành động bất khả hồi (mẫu ở H.2).
- `PhaseSyncGuard` — nếu nhận `roomState.phase` lạ → render overlay "Đang đồng bộ…" thay vì crash (mục 4.2).

**STATE (host-local store `useHostStore`):**
```
roomCode, hostToken, phase(GamePhase), mode(GameMode),
currentStation(StationId|null), currentQuestionId(string|null),
clockOffset(=serverNow-Date.now()), deadlineTs(number|null), durationSec,
counts{ total, connected, perTeam }, answeredCount, totalPlayers,
socketConnected(boolean), resumePhase(GamePhase|undefined)
```
- **Nguồn:** `roomState` (phase/mode/currentStation/currentQuestionId/serverNow/resumePhase), `playerList.counts`, `timerSync` (deadlineTs/serverNow/durationSec), `answerLocked`/`answerRevealed` (answeredCount).
- **DeadlineMeter:** `remaining = deadlineTs - (Date.now() + clockOffset)`; render `mm:ss`; đổi màu `--color-warning` khi `remaining < 5s`; `--dur-fast` cho tick.

**SỰ KIỆN socket:**
- **PHÁT khi vào console:** `joinRoom({ roomCode, role:"host", reconnectToken? })` → ack `{ok, reconnectToken}`.
- **LẮNG NGHE (mọi phase):** `roomState`, `playerList`, `timerSync`, `answerLocked`, `answerRevealed`, `modeChanged`, `errorEvent`, `bossPhase`, `leaderboardUpdate`, `gameEnded`.
- **Reconnect:** mất socket → `rejoin({reconnectToken})` → nhận lại `roomState` (+`stationOpened`+`timerSync` nếu đang ANSWERING).

**XÁC NHẬN:** không (shell chỉ hiển thị).

---

### H.1. Tạo/mở phòng · Mã + QR · Quản lý người vào · Chia lại đội  *(phase `LOBBY` → `TEAM_SELECT`)*

**MỤC ĐÍCH:** khởi tạo phòng, phát mã + QR để SV join `/play?room=XXXX`, kiểm duyệt nickname (đổi tên/kick), khóa lobby khi đủ người, và xếp/chia lại 6 đội trước khi vào game.

**WIREFRAME ASCII:**

```
┌───────────────────────────── LOBBY — PHÒNG 7F3K ──────────────────────────────────────────────┐
│  MÃ THAM GIA                         │  NGƯỜI CHƠI  (27/30)          [🔒 Khóa lobby ○]  [Sắp xếp▾]│
│   ┌───────────────┐   ┌───────────┐  │  ┌──────────────────────────────────────────────────────┐ │
│   │    7 F 3 K    │   │  ▓▓ ▓  ▓▓ │  │  │ #  Nickname          Đội      Kết nối   Thao tác     │ │
│   │  (mono, 96px) │   │  ▓ QR ▓▓  │  │  │ 01 MinhAnh           🟥 Đội1   ●        [✎][⎋]        │ │
│   └───────────────┘   │  ▓▓  ▓ ▓  │  │  │ 02 xX_ph4_Xx  ⚠      —         ●        [✎][⎋]        │ │
│   /play?room=7F3K     └───────────┘  │  │ 03 Huy               🟩 Đội4   ○ mất     [✎][⎋]        │ │
│   [Sao chép link] [Phóng to QR ⛶]    │  │ …                                                      │ │
│                                       │  └──────────────────────────────────────────────────────┘ │
│  PHÂN BỔ ĐỘI (kéo-thả / auto)        │   Theo đội: 🟥6 🟧5 🟨4 🟩4 🟦4 🟪4   Chưa đội: 0          │
│   [⚖ Chia đều tự động] [🎲 Xáo trộn] │                                                             │
│                                       │           ┌──────────────────────────────────────────────┐│
│   Kéo thẻ SV vào cột đội bên dưới…    │           │  ▶  BẮT ĐẦU — CHIA ĐỘI  (startGame)           ││
│   [🟥][🟧][🟨][🟩][🟦][🟪]           │           └──────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT / control:**
- `RoomCodeCard` — `roomCode` cỡ `--text-8xl`, `--font-mono`; `[Sao chép link]`, `[Phóng to QR ⛶]`.
- `QrCard` — QR mã hóa `${origin}/play?room=${roomCode}`; nút phóng to toàn màn (cho lớp quét).
- `PlayerRoster` — bảng: `#`, nickname, `TeamChip`, `ConnDot`, hàng thao tác `[✎ đổi tên]` `[⎋ kick]`; cờ `⚠` nếu nickname khớp bộ lọc từ xấu.
- `LobbyLockToggle` — `[🔒 Khóa lobby]` chặn join mới.
- `TeamAllocator` — kéo-thả SV vào 6 cột đội; `[⚖ Chia đều tự động]`, `[🎲 Xáo trộn]`.
- `TeamCountStrip` — `perTeam` theo màu `--team-{n}` + đếm "Chưa đội".
- `PrimaryCTA` — **BẮT ĐẦU — CHIA ĐỘI**.

**STATE:**
```
players: { playerId, nickname, avatar?, teamId|null, connected }[]   // từ playerList
counts{ total, connected, perTeam }
lobbyLocked(boolean)*            // host-local, phản chiếu từ server sau khi có event
nicknameFlags: Record<playerId, "profanity"|"ok">   // lọc phía host-local
draggingPlayerId?
```

**SỰ KIỆN socket:**
- **PHÁT (đã có trong hợp đồng):**
  - `startGame({ roomCode })` → server chuyển `LOBBY → TEAM_SELECT`.
- **LẮNG NGHE:** `playerList` (roster + counts), `teamAssigned` (xác nhận đội cho từng player), `roomState` (phase).
- **⚠ PHÁT (CHƯA CÓ trong mục 5 — đề xuất bổ sung hợp đồng trước khi code):**
  - Kick / đổi tên: `moderatePlayer({ playerId, action:"kick"|"rename", nickname? })`
  - Khóa lobby: `lockLobby({ locked:boolean })`
  - Xếp/chia lại đội (host chủ động, vì `chooseTeam` là player-side): `assignTeam({ playerId, teamId })` / `shuffleTeams()`

**XÁC NHẬN (🔒):**
- **Kick** → `ConfirmDialog`: "Loại **{nickname}** khỏi phòng? SV sẽ phải join lại bằng mã." — huỷ được, nhưng làm gián đoạn → confirm.
- **Xáo trộn đội** khi đã có phân bổ → confirm ("Xáo lại toàn bộ 6 đội?").
- `startGame` → confirm nhẹ nếu còn SV "Chưa đội" > 0.

---

### H.2. Bảng ĐIỀU PHỐI từng trạm + Xem trước câu hỏi & đáp án (chỉ host)  *(vòng lặp mỗi trạm)*

**MỤC ĐÍCH:** ổ điều khiển chính chạy đúng dòng chảy state machine của một trạm: **Mở trạm → Bắt đầu trả lời → Khóa → Chốt đáp án → Thẻ tri thức → Xếp hạng → Trạm kế**; đồng thời cho host **xem trước prompt + đáp án ĐÚNG + explain** để giảng (dữ liệu này KHÔNG bao giờ tới player/screen trước `answerRevealed`).

**WIREFRAME ASCII:**

```
┌──────────────────── ĐIỀU PHỐI · Trạm 2 "Eo Biển Tất Yếu" · Câu 2.3/4 ─────────────────────────┐
│ phase ▸ ●ANSWERING            ⏱ 00:23 còn lại        ✅ đã trả lời 21/27                          │
│                                                                                                  │
│ ┌── XEM TRƯỚC (HOST-ONLY, KHÔNG phát cho player/screen) ─────────────────────────────────────┐ │
│ │ type: mcq · topic: "tính tất yếu" · learningLevel: van_dung · difficulty:2 · basePoints:100  │ │
│ │ PROMPT: "Vì sao KTTT định hướng XHCN là tất yếu ở VN?"                                        │ │
│ │  A. …                                        C. …                                            │ │
│ │  B. ✔ ĐÁP ÁN ĐÚNG (correct.optionId="B")     D. …                     [explain ▾] [Thẻ TT ▾]  │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                  │
│ DÒNG CHẢY (nút sáng = hành động kế hợp lệ theo phase):                                            │
│  [ Mở trạm ]→[ Bắt đầu ]→[ Khóa ]→( 🔒 Chốt đáp án )→[ Thẻ tri thức ]→[ Xếp hạng ]→[ Trạm kế ]   │
│    STATION_   ANSWERING   LOCKED     REVEAL           KNOWLEDGE_       LEADER-      nextStation    │
│    OPEN                                                CARD            BOARD                       │
│                                                                                                  │
│  Điều hướng câu trong trạm:  [◂ Câu trước]  Câu 2.3  [Câu kế ▸]                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Ánh xạ Phase → CTA chính → event (bảng chốt cho host):**

| Phase hiện tại | Nút CTA chính | Event PHÁT | Chuyển sang |
|---|---|---|---|
| `INTRO` | Vào Trạm 1 | `openStation({station:1})` | `STATION_OPEN` |
| `STATION_OPEN` | Bắt đầu trả lời | `startAnswering({questionId})` | `ANSWERING` |
| `ANSWERING` | Khóa trạm | `lockAnswers({questionId})` | `LOCKED` *(hoặc server auto khi deadline)* |
| `LOCKED` | **🔒 Chốt đáp án** | `revealAnswer({questionId})` | `REVEAL` |
| `REVEAL` | Lật Thẻ tri thức | `showKnowledgeCard({questionId})` | `KNOWLEDGE_CARD` |
| `KNOWLEDGE_CARD` | Xếp hạng | `showLeaderboard()` | `LEADERBOARD` |
| `LEADERBOARD` | Trạm kế *(hoặc Vào BOSS sau trạm 4)* | `nextStation()` rồi `openStation(next)` / `startBoss()` | `STATION_OPEN` / `BOSS_INTRO` |
| `BOSS_INTRO` | Bắt đầu BOSS | `startAnswering({questionId})` | `BOSS_ANSWERING` |
| `BOSS_ANSWERING` | Khóa | `lockAnswers({questionId})` | `LOCKED`(boss) |
| `BOSS_REVEAL` | Xếp hạng | `showLeaderboard()` | `LEADERBOARD` |
| `VICTORY` | Tổng kết & Đóng phòng | `endGame()` | `ENDED` |

**COMPONENT / control:**
- `HostQuestionPreview` — hiển thị **đầy đủ đáp án** (badge `✔` `--color-success` trên option đúng, `explain`, `knowledgeCard`). Chỉ render khi `role==="host"`.
- `FlowStepper` — 7 nút theo state machine; nút "hành động kế hợp lệ" nổi bật (`--color-primary-600`), các nút không hợp lệ ở phase hiện tại `disabled` (mờ) — **chống bấm nhầm thứ tự**.
- `QuestionNav` — `[◂ Câu trước] / [Câu kế ▸]` trong trạm (đổi `currentQuestionId` để preview; chỉ phát khi bấm CTA mở/bắt đầu).
- `ConfirmDialog` (mẫu chuẩn dưới đây).

**STATE:**
```
hostQuestion: {                       // ⚠ nguồn host-only (xem ghi chú lệch hợp đồng)
  questionId, station, stationName, type, topic, learningLevel, difficulty,
  timeLimitSec, basePoints, prompt, options?/statements?/buckets?/items?,
  correct{ optionId?|wrongOptionId?|statements?|placement? }, explain, knowledgeCard
}
stationQuestionIds: string[]          // danh sách câu trong trạm hiện tại
currentQuestionId, phase, answeredCount, totalPlayers, deadlineTs
```

**SỰ KIỆN socket:**
- **PHÁT (hợp đồng):** `openStation`, `startAnswering`, `lockAnswers`, `revealAnswer`, `showKnowledgeCard`, `showLeaderboard`, `nextStation`, `startBoss` (tham số như bảng trên).
- **LẮNG NGHE:** `stationOpened` (đồng bộ prompt public + phase), `timerSync` (deadline), `answerLocked` (answeredCount), `answerRevealed` (đối chiếu `correct` + `stats`), `knowledgeCard`, `roomState`.
- **⚠ Xem trước đáp án (host-only):** hợp đồng hiện chỉ có `stationOpened` **đã lược đáp án** cho mọi role. Host cần kênh riêng chứa `correct/explain/knowledgeCard` → **đề xuất event `hostQuestion` (S→C, chỉ role `"host"`, sau khi kiểm `hostToken`)**. **Không** giải mã đáp án ở client theo bất kỳ cách nào khác (giữ nguyên tắc bảo mật vàng).

**XÁC NHẬN (🔒) — mẫu `ConfirmDialog`:**
```
┌──────────────────────────────────────────────┐
│  🔒 CHỐT ĐÁP ÁN — không thể hoàn tác           │
│  Công bố đáp án đúng + thống kê % cho CẢ lớp.  │
│  Sau bước này player sẽ thấy đúng/sai.          │
│  Đã trả lời: 21/27. Vẫn còn 6 SV chưa nộp.      │
│            [ Huỷ ]      [ Chốt đáp án ]         │
└──────────────────────────────────────────────┘
```
- **Chốt đáp án (`revealAnswer`)** → luôn confirm (bất khả hồi; cảnh báo nếu `answeredCount < totalPlayers`).
- **Trạm kế / Vào BOSS** khi chưa reveal câu hiện tại → confirm ("Bỏ qua công bố đáp án câu này?").

---

### H.3. ĐIỀU TIẾT THỜI GIAN — LITE↔CHUAN · ±giây · vòng tăng tốc · hạ số trạm

**MỤC ĐÍCH:** cho host co giãn nhịp lớp theo thực tế: đổi mode `lite`/`chuan`, cộng/trừ giây vào deadline đang chạy, bật preset "tăng tốc", và rút ngắn hải trình (bớt trạm) khi thiếu thời gian.

**WIREFRAME ASCII:**

```
┌──────────────── ⏲ ĐIỀU TIẾT THỜI GIAN ────────────────────────────────────────────────┐
│ Chế độ nhịp:   ( ◉ CHUAN )   ( ○ LITE )        → setMode({mode})                          │
│                 mô tả: CHUAN=đủ hiệu ứng · LITE=gọn, ít animation                          │
│                                                                                           │
│ Đồng hồ câu hiện tại:  ⏱ 00:23   deadlineTs=…                                             │
│    [ −10s ] [ −5s ]   |   [ +5s ] [ +10s ] [ +30s ]     [↺ Đặt lại = timeLimitSec]        │
│                                                                                           │
│ ⚡ Vòng tăng tốc (turbo):  [ Bật ○ ]   (giảm thời lượng mặc định các câu kế)              │
│                                                                                           │
│ 🗺 Kế hoạch trạm:   [✔T1] [✔T2] [✔T3] [✔T4] [✔BOSS]   → bỏ chọn để HẠ số trạm            │
│    Ước lượng còn lại: ~18 phút                     [ Áp dụng kế hoạch ]                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT / control:**
- `ModeToggle` — segmented `CHUAN | LITE` (giá trị `GameMode`).
- `TimerNudge` — nhóm `[−10s][−5s] | [+5s][+10s][+30s]` + `[↺ Đặt lại]`; hiển thị deadline realtime.
- `TurboToggle` — bật vòng tăng tốc (rút thời lượng các câu kế).
- `StationPlanEditor` — checklist `T1..T4, BOSS`; bỏ chọn = loại trạm; hiện "ước lượng còn lại".

**STATE:**
```
mode(GameMode: "lite"|"chuan"|"fallback"|"no-projector")
deadlineTs, durationSec, timeLimitSec
turbo(boolean)*                         // host-local đến khi có event
stationPlan: StationId[]*               // ["…" bỏ trạm] → chờ hợp đồng
```

**SỰ KIỆN socket:**
- **PHÁT (hợp đồng):** `setMode({ mode:"lite" })` / `setMode({ mode:"chuan" })` → server phát lại `modeChanged`. (FALLBACK / no-projector nằm ở H.6.)
- **LẮNG NGHE:** `modeChanged` (đồng bộ ModeBadge), `timerSync` (deadline mới sau khi ±giây).
- **⚠ PHÁT (CHƯA CÓ — đề xuất):**
  - `adjustTimer({ questionId, deltaSec })` → server dời `deadlineTs`, phát lại `timerSync` cho cả phòng (không để client tự cộng — giữ nguyên tắc thời gian vàng mục 5.4).
  - `setPace({ turbo:boolean })` *(hoặc coi turbo là preset của `setMode('lite')` + `adjustTimer` mặc định)*.
  - `setStationPlan({ stations: StationId[] })` → thay đổi hải trình còn lại.

**XÁC NHẬN (🔒):**
- **Hạ số trạm (`setStationPlan`)** → confirm ("Bỏ Trạm 3 khỏi hải trình? Câu ở trạm này sẽ không được chơi.") — ảnh hưởng cấu trúc game.
- `−giây` khiến `remaining < 3s` → cảnh báo nhẹ (dễ hết giờ ngay).
- Đổi mode: không cần confirm (đảo được).

---

### H.4. BẢNG ĐO FORMATIVE — % lớp đúng theo trạm/topic + đánh dấu ngộ nhận

**MỤC ĐÍCH:** cho host đọc nhanh mức nắm bài của cả lớp theo từng trạm & topic để **giảng lại đúng chỗ**; tự nổi bật đáp án sai bị chọn nhiều (ngộ nhận phổ biến).

**WIREFRAME ASCII:**

```
┌────────────────────── 📊 BẢNG ĐO FORMATIVE (từ answerRevealed.stats) ──────────────────────┐
│ Trạm / Topic                         %Lớp đúng     Ngộ nhận phổ biến (option bị chọn nhiều) │
│ ─────────────────────────────────────────────────────────────────────────────────────────── │
│ T1 Đảo Khái Niệm      · khái niệm     ▓▓▓▓▓▓▓▓░ 84%   —                                      │
│ T2 Eo Biển Tất Yếu    · tính tất yếu  ▓▓▓▓▓▓░░░ 61% ⚠  C "do nhà nước quyết định" ← 34% chọn │
│ T2 · quy luật KT       · van_dung      ▓▓▓▓░░░░░ 47% ⚠  A ← 41% chọn        [📌 Giảng lại]     │
│ T3 Quần Đảo Đặc Trưng · đặc trưng     ▓▓▓▓▓▓▓░░ 73%   B ← 22%                                 │
│ ─────────────────────────────────────────────────────────────────────────────────────────── │
│ TB lớp toàn hải trình: 68%      Câu yếu nhất: T2·van_dung (47%)     [Lọc: ⚠ dưới 60% ▾]       │
│                                                          [↻ Chiếu lại Thẻ tri thức câu này]    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT / control:**
- `FormativeTable` — mỗi dòng = 1 câu/topic: `stationName`, `topic`, `learningLevel`, thanh `classCorrectPct`, cột "ngộ nhận" (option/statement sai có `optionPct` cao nhất).
- `MisconceptionFlag` — `⚠` tự bật khi `classCorrectPct < 60%`; ô "ngộ nhận" tô nền `--color-danger-bg`.
- `ReteachPin` — `[📌 Giảng lại]` đánh dấu host-local để quay lại cuối buổi.
- `ReteachReplay` — `[↻ Chiếu lại Thẻ tri thức câu này]` → re-emit để lớp cùng xem lại.
- `PctFilter` — lọc "dưới 60%".

**STATE (tích lũy host-local qua các reveal):**
```
formative: Record<questionId, {
  station, stationName, topic, learningLevel,
  classCorrectPct,
  optionPct?/statementCorrectPct?/bucketCorrectPct?,
  topDistractorId?              // option sai bị chọn nhiều nhất (tính từ optionPct)
}>
reteachPinned: Set<questionId>  // host-local
classAvgPct(derived)
```
- **Nguồn:** gom từ mỗi `answerRevealed.stats` (`classCorrectPct`, `optionPct`, `statementCorrectPct`, `bucketCorrectPct`) + `hostQuestion` (để biết đâu là distractor sai).

**SỰ KIỆN socket:**
- **LẮNG NGHE (chỉ đọc, không phát mới):** `answerRevealed` (nạp stats), `leaderboardUpdate` (bối cảnh xếp hạng).
- **PHÁT khi "Giảng lại / Chiếu lại" (dùng lại event hợp đồng):** `showKnowledgeCard({questionId})` để lật lại Thẻ Tri Thức của câu đó, hoặc `revealAnswer({questionId})` nếu muốn chiếu lại phân bố % — **tái sử dụng đúng event có sẵn**, không cần event mới.

**XÁC NHẬN:** không (bảng đọc); "Chiếu lại" chỉ chiếu, không đổi điểm.

---

### H.5. Điều khiển hiệu ứng — nhạc · reaction · chế độ "lật kèo" (BOSS)

**MỤC ĐÍCH:** bật/tắt nhạc nền & luồng emoji reaction trên BIG SCREEN, và kích hoạt màn "lật kèo" — trận **BOSS (Cơn Bão Nhà Ở Xã Hội)** nhân điểm.

**WIREFRAME ASCII:**

```
┌──────────────── 🎛 HIỆU ỨNG & LẬT KÈO ─────────────────────────────────────────────────┐
│  🎵 Nhạc nền        [ Bật ◉ ]   volume ▓▓▓▓▓░░                                            │
│  😊 Reaction emoji  [ Bật ◉ ]   (player gửi → reactionBroadcast bay trên /present)        │
│                                                                                           │
│  ⛈ LẬT KÈO — BOSS "Cơn Bão Nhà Ở Xã Hội"                                                  │
│     Nhân điểm hiện tại (server-config): ×2   ← hợp đồng: bossPhase.pointsMultiplier        │
│     [ 🔒 KÍCH HOẠT BOSS ]   (chỉ khả dụng sau khi hoàn tất Trạm 4)                          │
│     ⚠ Yêu cầu "×3" cần cập nhật NỀN TẢNG (hiện chốt ×2) — xem ghi chú.                     │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT / control:**
- `MusicToggle` + `VolumeSlider` — điều khiển audio trên BIG SCREEN.
- `ReactionToggle` — bật/tắt luồng emoji.
- `BossTrigger` — `[🔒 KÍCH HOẠT BOSS]`, `disabled` cho tới khi trạm 4 xong; hiển thị `pointsMultiplier` hiện hành.

**STATE:**
```
musicOn(boolean)*, volume(number)*, reactionsOn(boolean)*     // host-local đến khi có event
bossMultiplier(number)   // đọc từ bossPhase.pointsMultiplier (hợp đồng = 2)
stationsDone(StationId[]) // để enable BossTrigger sau trạm 4
```

**SỰ KIỆN socket:**
- **PHÁT (hợp đồng):** `startBoss()` → server chuyển `LEADERBOARD/… → BOSS_INTRO`, phát `bossPhase({ phase:"BOSS_INTRO", pointsMultiplier, title:"Cơn Bão Nhà Ở Xã Hội" })`.
- **LẮNG NGHE:** `bossPhase` (đồng bộ multiplier + tiêu đề, áp màu `--color-boss`), `reactionBroadcast` (đếm/hiển thị).
- **⚠ PHÁT (CHƯA CÓ — đề xuất):** kênh điều khiển hiệu ứng tới BIG SCREEN: `setEffects({ music?:boolean, volume?:number, reactions?:boolean })` → server phát tới role `"screen"`.
- **Xung đột spec (BOSS ×2 vs "×3"):** NỀN TẢNG chốt **×2** (`--color-boss` "tím bão ×2", `bossPhase.pointsMultiplier` ví dụ 2). Host **không** truyền multiplier khi `startBoss()` — giá trị do server (`bossPhase.pointsMultiplier`). Muốn **×3** phải **cập nhật NỀN TẢNG + config server trước**, không hardcode ở FE.

**XÁC NHẬN (🔒):**
- **Kích hoạt BOSS (`startBoss`)** → confirm ("Vào trận BOSS — nhân điểm ×{multiplier}. Không quay lại các trạm thường.").
- Nhạc/Reaction: không cần confirm (bật/tắt tức thời).

---

### H.6. NÚT CỨU HỘ — bỏ câu · chơi lại câu · FALLBACK · không máy chiếu · kết thúc sớm

**MỤC ĐÍCH:** xử lý sự cố tại lớp: bỏ qua câu lỗi, cho chơi lại câu, hạ về chế độ mạng lỗi (`fallback`), chuyển "không cần máy chiếu" (`no-projector`), và kết thúc sớm.

**WIREFRAME ASCII (mở rộng từ thanh cứu hộ dưới):**

```
┌──────────────────────────── 🆘 BẢNG CỨU HỘ ──────────────────────────────────────────────┐
│  Trạng thái: phase=ANSWERING · mode=CHUAN · socket ●                                        │
│                                                                                             │
│  [ ⏸ Tạm dừng để giảng ]  ←→  [ ▶ Tiếp tục ]        (pauseGame / resumeGame, giữ deadline)  │
│                                                                                             │
│  [ ⏭ Bỏ qua câu* ]     bỏ câu hiện tại, sang câu kế, không tính điểm                        │
│  [ ↺ Chơi lại câu* ]   mở lại câu để lớp trả lời lại                                         │
│                                                                                             │
│  [ ⚡ Chuyển FALLBACK ]     mạng lỗi → quiz tối giản (setMode 'fallback')                    │
│  [ 📵 Không cần máy chiếu ] bản đồ/xếp hạng hiện trên điện thoại (setMode 'no-projector')    │
│                                                                                             │
│  [ ⛔ 🔒 KẾT THÚC SỚM ]     đóng phòng ngay (endGame)                                        │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT / control:**
- `PauseResumeButton` — chuyển `pauseGame ↔ resumeGame`; overlay PAUSED hiện trên player/screen, **giữ `resumePhase`** (mục 4.2).
- `SkipQuestionButton*` / `ReplayQuestionButton*` — cứu hộ câu lỗi.
- `FallbackButton` — sang `mode:"fallback"`.
- `NoProjectorButton` — sang `mode:"no-projector"`.
- `EndEarlyButton` — `endGame()`.

**STATE:**
```
phase, mode, resumePhase, currentQuestionId, socketConnected
```

**SỰ KIỆN socket:**
- **PHÁT (hợp đồng):**
  - `pauseGame()` → `PAUSED` (server nhớ `resumePhase`); `resumeGame()` → quay lại phase đang dở.
  - `setMode({ mode:"fallback" })` → `modeChanged`; FE tắt animation nặng/emoji (mục 5.4).
  - `setMode({ mode:"no-projector" })` → BIG SCREEN tắt, player tự render bản đồ/xếp hạng từ `leaderboardUpdate`.
  - `endGame()` → `ENDED`.
- **LẮNG NGHE:** `roomState` (phase/resumePhase), `modeChanged`, `errorEvent` (nếu server báo lỗi khi cứu hộ).
- **⚠ PHÁT (CHƯA CÓ — đề xuất):**
  - `skipQuestion({ questionId })` — bỏ câu, không tính điểm.
  - `replayQuestion({ questionId })` — server reset trạng thái nhận đáp án câu đó rồi phát lại `stationOpened`+`timerSync` (lưu ý `submitAnswer` idempotent theo `questionId` mục 5.4 → **cần server hỗ trợ reset**, FE không tự làm được).

**XÁC NHẬN (🔒):**
- **Kết thúc sớm (`endGame`)** → confirm nặng: "ĐÓNG PHÒNG NGAY? Không thể tiếp tục. Điểm hiện tại sẽ là kết quả cuối." + gõ/PIN xác nhận.
- **Chuyển FALLBACK** → confirm ("Hạ về chế độ mạng lỗi? Tắt hiệu ứng realtime.").
- **Bỏ qua câu** → confirm ("Bỏ câu {questionId}? Không ai được điểm câu này.").
- **Chơi lại câu** → confirm ("Mở lại câu cho lớp trả lời lại? Điểm câu này sẽ được tính lại.").
- Tạm dừng / Không máy chiếu: không cần confirm (đảo được ngay).

---

### H.7. Kết thúc & tổng kết + xuất báo cáo  *(phase `VICTORY` → `ENDED`)*

**MỤC ĐÍCH:** trình bày tàu về **Cảng đích "Dân giàu – Nước mạnh – Dân chủ – Công bằng – Văn minh"**, công bố đội vô địch + top SV, và cho host xuất báo cáo buổi học (điểm + formative).

**WIREFRAME ASCII:**

```
┌───────────────────── 🏁 TỔNG KẾT — VỀ CẢNG ĐÍCH ──────────────────────────────────────────┐
│  ⚓ Cảng: Dân giàu · Nước mạnh · Dân chủ · Công bằng · Văn minh                              │
│                                                                                             │
│  🏆 ĐỘI VÔ ĐỊCH: 🟩 Lục Rong Biển (Đội 4)  —  4,820đ                                        │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  Xếp hạng đội:                     Top SV:                                                   │
│   1. 🟩 Đội4  4,820                 1. MinhAnh   980   🔥streak 6                             │
│   2. 🟦 Đội5  4,110                 2. Huy       910                                          │
│   3. 🟥 Đội1  3,940                 3. Lan       870                                          │
│   …                                 …                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  TB lớp toàn hải trình: 68%   ·  Câu yếu nhất: T2·van_dung (47%)                             │
│                                                                                             │
│  [ ⬇ Xuất báo cáo (CSV) ]  [ ⬇ Xuất PDF ]     [ ⛔ 🔒 Đóng phòng (endGame) ]                 │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

**COMPONENT / control:**
- `VictoryBanner` — cảng đích + đội vô địch (màu `--team-{n}`, glow `--shadow-glow`).
- `FinalTeamRank` / `TopPlayers` — từ `gameEnded`.
- `ClassSummary` — TB lớp + câu yếu nhất (từ `formative` H.4).
- `ExportReport` — `[⬇ CSV]` `[⬇ PDF]` xuất **client-side** từ dữ liệu tích lũy (không cần event).
- `EndRoomButton` — `endGame()`.

**STATE:**
```
gameEndedData: {
  winnerTeam{ teamId, teamName, score },
  topPlayers[], finalTeams[]
}                                   // từ gameEnded
formative (H.4) + leaderboard snapshot cuối
```

**SỰ KIỆN socket:**
- **LẮNG NGHE:** `gameEnded` (winnerTeam/topPlayers/finalTeams), `leaderboardUpdate` (snapshot cuối), `roomState` (VICTORY/ENDED).
- **PHÁT (hợp đồng):** `endGame()` → `ENDED` (đóng phòng). Vào VICTORY qua CTA sau BOSS (advance `nextStation()` theo state machine 4.2).
- **Xuất báo cáo:** **client-side**, tổng hợp từ `formative` + `leaderboardUpdate` + `gameEnded` → tải file. *(Nếu muốn báo cáo server-side chuẩn hóa → ⚠ đề xuất `requestReport()` — không bắt buộc.)*

**XÁC NHẬN (🔒):**
- **Đóng phòng (`endGame`)** → confirm ("Đóng phòng 7F3K? SV mất kết nối, không mở lại được.").
- Xuất báo cáo: không cần.

---

### ⚠ Ghi chú lệch hợp đồng (phải cập nhật NỀN TẢNG mục 5 trước khi code)

> Console host bám sát mục 5.2, nhưng các yêu cầu dưới đây **chưa có event trong hợp đồng**. Theo quy tắc "đổi tên event PHẢI cập nhật tài liệu trước", đây là danh sách **đề xuất bổ sung** (tên tạm, chờ Lead chốt) — FE **không** tự phát các event này cho tới khi hợp đồng cập nhật:

| # | Yêu cầu (mục) | Event/nguồn hợp đồng có sẵn | Đề xuất bổ sung |
|---|---|---|---|
| 1 | Host xem trước **đáp án đúng** (H.2) | `stationOpened` đã lược đáp án cho MỌI role | **S→C `hostQuestion`** (chỉ role `host`, có `correct/explain/knowledgeCard`) |
| 2 | Đổi tên / kick nickname xấu (H.1) | `playerList` (chỉ đọc) | `moderatePlayer({playerId, action:"kick"\|"rename", nickname?})` |
| 3 | Khóa lobby (H.1) | — | `lockLobby({locked})` |
| 4 | Host chia/xáo lại đội (H.1) | `chooseTeam` là player-side; `teamAssigned` chỉ đọc | `assignTeam({playerId, teamId})` / `shuffleTeams()` |
| 5 | ± giây đồng hồ (H.3) | `timerSync` là S→C | `adjustTimer({questionId, deltaSec})` → server phát lại `timerSync` |
| 6 | Vòng tăng tốc (H.3) | — | `setPace({turbo})` hoặc preset `setMode('lite')`+`adjustTimer` |
| 7 | Hạ số trạm (H.3) | — | `setStationPlan({stations:StationId[]})` |
| 8 | Bỏ qua câu (H.6) | — | `skipQuestion({questionId})` |
| 9 | Chơi lại câu (H.6) | `submitAnswer` idempotent theo `questionId` | `replayQuestion({questionId})` (server reset nhận đáp án) |
| 10 | Bật/tắt nhạc + reaction (H.5) | `reactionBroadcast` (chỉ đọc) | `setEffects({music?, volume?, reactions?})` → tới role `screen` |
| 11 | BOSS "×3" (H.5) | Hợp đồng chốt **×2** (`bossPhase.pointsMultiplier`) | Cần cập nhật NỀN TẢNG + config server; host chỉ `startBoss()` |
| 12 | Xuất báo cáo (H.7) | Tổng hợp client-side từ `answerRevealed`/`leaderboardUpdate`/`gameEnded` | (tuỳ chọn) `requestReport()` cho báo cáo server-side |
| 13 | "next" ở bảng 4.1/4.2 (TEAM_SELECT→INTRO, INTRO→trạm, LEADERBOARD→VICTORY) | 5.2 chỉ có `nextStation()` | Dùng `nextStation()` làm event "advance"; đồng bộ tên "next" trong tài liệu |

**Tokens đã dùng (không hardcode):** màu `--color-primary-600` (CTA), `--color-success/-bg` & `--color-danger/-bg` (đúng/sai + ngộ nhận), `--color-warning` (đếm ngược gấp), `--color-boss` (BOSS), `--team-1..6` (chip đội), `--color-info` (thông báo); chữ `--font-mono` (PIN/countdown) & `--font-display`/`--font-body`; `--text-xs..8xl`, `--space-*`, `--radius-lg/xl`, `--shadow-md/lg/glow`, `--dur-fast/base`, `--ease-out`. Console giữ alias sáng mục 3.7; tôn trọng `prefers-reduced-motion`.

---

# PHẦN E — THƯ VIỆN COMPONENT & TƯƠNG TÁC

## Thư viện Component & Tương tác

> Phần này là **spec triển khai** cho `src/shared/components/`. Mọi component **chỉ dùng token** (mục 3), **chỉ đọc dữ liệu từ event** (mục 5) và **chỉ render theo `phase`/`type`** (mục 4, 6). Không hardcode màu/px, không tự chấm điểm, không giả định đáp án trước `answerRevealed`.
> Quy ước file: `src/shared/components/<Name>/<Name>.tsx` + `<Name>.variants.ts` (Framer Motion) + `index.ts`. Component dùng riêng 1 app đặt trong `src/apps/<app>/components/`.

---

### A. Quy ước chung của thư viện

**Kiểu dùng lại (import từ `src/shared/socket/events.ts`):** `Role`, `TeamId`, `StationId`, `QuestionType`, `GamePhase`, `GameMode`, `PublicQuestion`, `AnswerPayload`.

```ts
// src/shared/components/common.ts
export type AppKind = "player" | "screen" | "host";   // ⟵ khớp role

// Trạng thái hiển thị 1 lựa chọn — DÙNG CHUNG cho mọi renderer câu hỏi.
// "correct"/"wrong" CHỈ được set SAU khi nhận answerRevealed.
export type ChoiceState = "idle" | "selected" | "disabled" | "correct" | "wrong";

// Kích thước ngữ cảnh — component tự scale token typography theo đây.
export type SizeCtx = "player" | "tv" | "console";

export interface TeamMeta { teamId: TeamId; teamName: string; } // màu = var(--team-{teamId})
```

**Nguyên tắc bất di:**
- Component **không nhận `correct`** qua props ở phase `ANSWERING`/`BOSS_ANSWERING`. Prop `reveal?` chỉ được truyền khi phase ∈ `REVEAL | BOSS_REVEAL | KNOWLEDGE_CARD`.
- Màu đội **luôn** lấy từ `var(--team-${teamId})` (mục 3.2), không map tay.
- Mọi thời gian đếm ngược lấy `deadlineTs` từ `timerSync`; component **không** tự `setInterval` countdown độc lập với server (chỉ dùng `requestAnimationFrame` để vẽ, giá trị = `deadlineTs - (Date.now() + clockOffset)`).

---

### B. Component tái sử dụng (Props + Trạng thái)

#### 1. `Timer` — đồng bộ theo deadline server
Vẽ vòng/thanh đếm ngược từ **mốc tuyệt đối**; đổi màu khi sắp hết giờ; không đếm ngược độc lập client.

```ts
interface TimerProps {
  deadlineTs: number;         // từ timerSync.deadlineTs (epoch ms tuyệt đối)
  serverNow: number;          // từ timerSync/roomState → tính clockOffset 1 lần
  durationSec: number;        // timerSync.durationSec (để vẽ % vòng)
  variant?: "ring" | "bar" | "giant";  // player=ring, host=bar, screen=giant
  size?: SizeCtx;
  paused?: boolean;           // phase===PAUSED → dừng vẽ, giữ remaining
  onExpire?: () => void;      // chỉ đổi UI (khóa nút); KHÔNG tự chấm
}
```
- **Trạng thái theo `remaining = deadlineTs - (Date.now() + clockOffset)`**:
  `normal` (>10s) → `var(--color-primary-500)`; `warning` (≤10s) → `var(--color-warning)` + nhịp đập; `critical` (≤3s) → `var(--color-danger)` + rung số; `expired` (≤0) → hiển thị "Hết giờ", gọi `onExpire`.
- `variant="giant"` (BIG SCREEN) dùng `--text-9xl` + `--font-mono`; `ring` (player) đường kính ~72px neo góc trên câu hỏi.
- Khi `PAUSED`: freeze; khi `resumeGame` server bắn `timerSync` mới → nhận `deadlineTs` mới, không tự cộng.

#### 2. `OptionButton` — 1 lựa chọn (mcq / selectwrong)
```ts
interface OptionButtonProps {
  optionId: string;
  text: string;
  index: number;                 // để gán ký hiệu A/B/C/D
  state: ChoiceState;            // idle|selected|disabled|correct|wrong
  emphasisWrong?: boolean;       // type==="selectwrong" → nhấn "chọn cái SAI"
  pct?: number;                  // reveal: % lớp chọn (answerRevealed.stats.optionPct)
  size?: SizeCtx;
  onSelect?: (optionId: string) => void;
}
```
- **Bản đồ trạng thái → token:**
  - `idle`: `--surface`, viền `--color-neutral-300`, chữ `--text`.
  - `selected`: viền + glow `--color-primary-600`, nền `--color-primary-100`; `:active` scale `.97` (`--dur-fast`).
  - `disabled`: opacity .6, `pointer-events:none` (đã gửi / phase `LOCKED`).
  - `correct`: nền `--color-success-bg`, viền `--color-success`, **icon ✔ + chữ "Đúng"** (không chỉ dựa màu).
  - `wrong`: nền `--color-danger-bg`, viền `--color-danger`, **icon �’✗ + chữ "Sai"**.
- Cao ≥ 56px, chữ `--text-lg`, `--radius-lg`. Reveal hiện thanh `pct` mảnh phía dưới (nền `--color-primary-300`).
- **selectwrong**: badge nhỏ "CHỌN Ý SAI" màu `--color-warning`; ở reveal, ô cần chọn = `wrongOptionId` được tô `correct` (đúng lựa chọn), các ô còn lại trung tính.

#### 3. `TrueFalseRow` — 1 nhận định Đúng/Sai
```ts
interface TrueFalseRowProps {
  statementId: string;
  text: string;
  value?: boolean;               // lựa chọn cục bộ (Record<id,boolean>)
  locked?: boolean;              // phase LOCKED/đã gửi
  reveal?: { correct: boolean; correctPct?: number }; // từ answerRevealed
  onChange?: (id: string, v: boolean) => void;
}
```
- Toggle đôi **Đúng | Sai**, mỗi nút ≥44×44px; chọn Đúng → `--color-success` viền, Sai → `--color-danger` viền (khi chọn), nhưng **kèm nhãn chữ** để không chỉ dựa màu.
- Reveal: nếu `value===reveal.correct` → hàng nền `--color-success-bg` + ✔; lệch → `--color-danger-bg` + ✗ và hiển thị đáp án đúng dạng chữ ("Đáp án: Đúng/Sai"). `correctPct` = `stats.statementCorrectPct[id]`.

#### 4. `DraggableCard` + `DropBucket` — kéo–thả mobile (dragdrop)
Dùng Framer Motion `drag` + hit-test tâm thẻ vào bucket (không dùng HTML5 DnD vì kém trên mobile). Có **fallback tap-to-place** (chạm thẻ → chạm bucket) cho thiết bị cảm ứng lỗi.
```ts
interface DraggableCardProps {
  itemId: string;
  text: string;
  placedIn?: string | null;      // bucketId hiện tại (state cục bộ Record<itemId,bucketId>)
  locked?: boolean;
  reveal?: { correctBucketId: string; isCorrect: boolean }; // sau answerRevealed
  onPick?: (itemId: string) => void;                 // fallback tap
  onDrop?: (itemId: string, bucketId: string) => void;
}
interface DropBucketProps {
  bucketId: string;
  name: string;
  items: { itemId: string; text: string }[];
  isActiveTarget?: boolean;      // thẻ đang hover trên bucket → highlight
  correctPct?: number;           // reveal: stats.bucketCorrectPct[bucketId]
  size?: SizeCtx;
}
```
- Thẻ: `--radius-md`, `--shadow-md`, khi kéo `--shadow-lg` + scale `1.04`; bucket target hover viền `--color-primary-600` dashed.
- Reveal: thẻ đặt đúng → `--color-success` + ✔; sai → `--color-danger` + ✗ **và** mũi tên/nhãn chỉ về bucket đúng (`correctBucketId` = `answerRevealed.correct.placement[itemId]`).
- BIG SCREEN chỉ hiện tên bucket + đếm số đội đã nộp (theo mục 6), không hiện thao tác kéo.

#### 5. `MatchPair` — ghép nối trái→phải (matching)
```ts
interface MatchPairProps {
  leftItems: { itemId: string; text: string }[];   // items[]
  rightBuckets: { id: string; name: string }[];    // buckets[]
  placement: Record<string, string>;               // itemId(trái) -> bucketId(phải)
  locked?: boolean;
  reveal?: { correct: Record<string, string>;      // answerRevealed.correct.placement
             perItemCorrect: Record<string, boolean> };
  onConnect?: (itemId: string, bucketId: string) => void;
  size?: SizeCtx;
}
```
- Nối bằng **chạm trái rồi chạm phải** (vẽ đường nối SVG màu đội/`--color-primary-500`); mỗi endpoint ≥44px.
- Reveal: đường nối đúng → `--color-success`, sai → `--color-danger` (nét đứt) + vẽ thêm đường đúng mờ; kèm ✔/✗ đầu mỗi item.

#### 6. `ComboMeter` / `StreakBadge` — chuỗi đúng liên tiếp
```ts
interface StreakBadgeProps {
  streak: number;                // answerRevealed.yourResult.streak
  justIncreased?: boolean;       // kích hoạt animation pulse
  size?: SizeCtx;
}
interface ComboMeterProps {
  streak: number;
  multiplierHint?: number;       // gợi ý hệ số combo (hiển thị, không tự tính điểm)
}
```
- Badge hình lửa/kho báu `--color-accent-500`, glow `--shadow-glow`; ≥3 streak đổi `--font-display` `--text-2xl` + nhãn "🔥 x{streak}".
- `justIncreased` → pop scale `1→1.3→1` (`--dur-base`, `--ease-out`) + phát âm `combo` (mục D). Điểm thật do server tính; component chỉ hiển thị `yourResult`.

#### 7. `ShipMap` — bản đồ hải trình + 6 con tàu
```ts
interface ShipMapProps {
  ships: { teamId: TeamId; progress: number;       // 0..1 (leaderboardUpdate.shipPositions)
           stationReached: StationId }[];
  destinationLabel?: string;     // mặc định "Dân giàu – Nước mạnh – Dân chủ – Công bằng – Văn minh"
  stations?: { id: StationId; name: string; x: number }[]; // mốc trạm trên tuyến
  size?: SizeCtx;                // tv (mặc định) | player (khi mode no-projector)
  animateFrom?: Record<TeamId, number>; // progress cũ → tween tàu tiến
}
```
- Tuyến biển ngang, 4 mốc trạm + hải đăng + **cảng đích** cuối. Tàu = `var(--team-{teamId})`, kích thước theo `size`.
- Tàu tiến bằng tween `progress` (mục C). Trên BIG SCREEN dùng nền `data-theme="dark"`; ở `mode==="no-projector"` render thu nhỏ trong PLAYER (đọc cùng `leaderboardUpdate`).

#### 8. `LeaderboardList` / `LeaderboardRow` — xếp hạng kép
```ts
interface LeaderboardListProps {
  scope: "team" | "player";
  teams?: { teamId: TeamId; teamName: string; score: number; rank: number }[];
  players?: { playerId: string; nickname: string; teamId: TeamId;
              score: number; streak: number; rank: number }[];
  highlightId?: string | TeamId; // tô đậm "mình"/đội mình
  maxRows?: number;              // player app: top N + hàng "bạn"
  size?: SizeCtx;
}
interface LeaderboardRowProps {
  rank: number; label: string; score: number;
  teamId: TeamId; delta?: number;   // thay đổi hạng để animate "lật kèo"
  isSelf?: boolean; size?: SizeCtx;
}
```
- Hàng: dải màu đội bên trái, hạng `--font-mono`, điểm `--font-display`. BIG SCREEN điểm ≥ `--text-8xl`.
- `delta` ≠ 0 → animate đổi vị trí (FLIP) + hiệu ứng "lật kèo" (mục C). Player thấy top ~5 + luôn ghim hàng của mình (`isSelf`).

#### 9. `KnowledgeCard` — Thẻ Tri Thức (mặt trước/sau)
```ts
interface KnowledgeCardProps {
  title: string;                 // knowledgeCard.knowledgeCard.title
  body: string;                  // .body
  explain: string;               // knowledgeCard.explain
  badge?: string;                // .badge (huy hiệu trạm)
  station: StationId;            // .station → màu/biểu tượng trạm
  side: "front" | "back";        // front=teaser, back=nội dung + explain
  onFlip?: () => void;           // host điều khiển; player theo phase KNOWLEDGE_CARD
  size?: SizeCtx;
}
```
- Front: tên thẻ + `badge` `--color-accent-500` glow. Back: `body` + `explain`, viền theo trạm. Lật 3D (mục C). Chỉ render ở phase `KNOWLEDGE_CARD` (dữ liệu đến **sau** reveal — đúng quy tắc bảo mật).

#### 10. `QRPanel` — mã phòng + QR vào phòng
```ts
interface QRPanelProps {
  roomCode: string;              // hiển thị --font-mono, cỡ lớn
  joinUrl: string;              // vd `${origin}/play?room=ABCD`
  size?: SizeCtx;               // tv=khổng lồ (LOBBY trên máy chiếu)
  showCount?: { connected: number; total: number }; // playerList.counts
}
```
- Dùng ở `LOBBY`. QR sinh client-side (không gọi mạng ngoài). BIG SCREEN: mã phòng `--text-8xl`, QR cạnh ≥ 320px, tương phản cao.

#### 11. `ReactionBar` — emoji reaction
```ts
interface ReactionBarProps {
  emojis?: string[];             // mặc định ["❤️","😮","😂","🔥","🌊","🏴‍☠️"]
  disabled?: boolean;            // ANSWERING? cho phép; mode fallback → ẩn
  onReact: (emoji: string) => void;   // → emit sendReaction({emoji})
}
interface ReactionOverlayProps {      // lớp bay emoji (player + screen)
  incoming: { id: string; emoji: string; teamId: TeamId | null }[]; // từ reactionBroadcast
}
```
- Nút tròn ≥44px. `ReactionOverlay` cho emoji bay lên (float + fade, `--dur-slow`), tô nhẹ theo `var(--team-{teamId})`. Ở `mode==="fallback"`: ẩn để giảm realtime (quy tắc mục 5.4).

#### 12. `ConnectionBanner` — trạng thái kết nối
```ts
type ConnStatus = "online" | "reconnecting" | "offline" | "fallback" | "no-projector";
interface ConnectionBannerProps {
  status: ConnStatus;            // suy ra từ socket + modeChanged.mode
  retryInSec?: number;           // đếm tới lần reconnect kế
  onRetryNow?: () => void;       // gọi rejoin({reconnectToken})
}
```
- `online`: ẩn/chấm xanh nhỏ. `reconnecting`: banner `--color-warning` "Đang kết nối lại… giữ nguyên điểm". `offline`: `--color-danger` + nút "Thử lại". `fallback`: `--color-info` "Chế độ nhẹ (mạng yếu)". `no-projector`: `--color-info` "Không máy chiếu — xem bản đồ tại đây". Neo đỉnh màn, dưới safe-area top.

#### 13. `StationBadge` — huy hiệu/tên trạm
```ts
interface StationBadgeProps {
  station: StationId;            // 1..4 | "boss"
  name?: string;                 // stationName (mặc định theo phụ lục)
  variant?: "pill" | "banner" | "trophy";
  size?: SizeCtx;
}
```
- Trạm 1–4 dùng `--color-primary-600`; `boss` dùng `--color-boss` + badge "x2". `banner` cho `STATION_OPEN`/`BOSS_INTRO`, `pill` cho góc câu hỏi.

#### 14. `ScorePopup` — điểm bay khi reveal
```ts
interface ScorePopupProps {
  pointsEarned: number;          // yourResult.pointsEarned (đã gồm tốc độ+combo+boss)
  speedBonus?: number;           // yourResult.speedBonus
  isCorrect: boolean;            // yourResult.isCorrect
  multiplier?: number;           // bossPhase.pointsMultiplier → hiện "x2"
}
```
- Đúng: "+{points}" `--color-success` bay lên; có `speedBonus` → dòng phụ "⚡ +{speedBonus}"; boss → "x2" `--color-boss`. Sai: "+0" mờ + shake nhẹ. Chỉ xuất hiện **sau `answerRevealed`** (dữ liệu `yourResult`).

#### 15. `PhaseBanner` — nhãn phase hiện tại (điều phối/hiển thị)
```ts
interface PhaseBannerProps {
  phase: GamePhase;              // roomState.phase
  mode: GameMode;                // roomState.mode
  station?: StationId | null;    // roomState.currentStation
  audience: AppKind;             // player|screen|host → mức chi tiết khác nhau
}
```
- Bảng nhãn tiếng Việt cố định theo phase: `LOBBY`→"Phòng chờ", `TEAM_SELECT`→"Chọn đội", `INTRO`→"Giới thiệu hải trình", `STATION_OPEN`→"Cập bến {tên trạm}", `ANSWERING`→"Đang trả lời", `LOCKED`→"Đã khóa", `REVEAL`→"Công bố đáp án", `KNOWLEDGE_CARD`→"Thẻ Tri Thức", `LEADERBOARD`→"Xếp hạng", `BOSS_INTRO`→"Cơn Bão Nhà Ở Xã Hội", `BOSS_ANSWERING`→"BOSS x2", `BOSS_REVEAL`→"Kết quả BOSS", `VICTORY`→"Về cảng đích", `ENDED`→"Kết thúc", `PAUSED`→"Tạm dừng", `FALLBACK`→"Chế độ nhẹ".
- HOST hiển thị **đầy đủ**: phase + `mode` + deadline còn lại + số kết nối; PLAYER/SCREEN chỉ hiển thị nhãn gọn.

**Component phụ trợ đi kèm (dùng lại nhiều nơi):**
- `ActionBar` (player) — thanh hành động neo đáy ≥56px, safe-area bottom, chứa nút chính "Gửi đáp án" → `submitAnswer`.
- `SubmitButton` — states `ready | sending (spinner chờ answerAck) | sent | locked`.
- `StatBar` — thanh % (`stats.*Pct`) dùng ở reveal.
- `SkeletonBlock` — khung xám shimmer khi chờ `stationOpened`.
- `TeamColorChip` / `TeamPill` — chip màu đội `var(--team-{teamId})` + tên.
- `NicknameForm` (LOBBY, gọi `setNickname`) / `TeamPicker` (TEAM_SELECT, gọi `chooseTeam`).
- `BossStormOverlay` — lớp phủ tím bão `--color-boss` cho `BOSS_*`.
- `SyncingScreen` — màn "Đang đồng bộ…" khi nhận phase chưa hỗ trợ (quy tắc chống crash mục 4.2).

---

### C. Motion / Animation (Framer Motion)

**Nguyên tắc:** mọi thời lượng/easing đọc từ token `--dur-fast/base/slow` + `--ease-out`; khi `prefers-reduced-motion` bật, token đã hạ về `0ms` (mục 3.7) → animation tự trở thành cut. BIG SCREEN giữ thời lượng **0.6–1.2s** (mục 1.2), không rung lắc mạnh.

**1. Chuyển cảnh giữa phase (mọi app):** bọc nội dung theo phase trong `<AnimatePresence mode="wait">`, key = `roomState.phase`.
- Vào: `opacity 0→1, y 12→0`, `--dur-base` (300ms), `--ease-out`. Ra: `opacity 1→0, y 0→-8`, `--dur-fast`.
- `STATION_OPEN`/`BOSS_INTRO`: banner trạm trượt ngang + sóng biển dâng (`--dur-slow`).
- `PAUSED`/`FALLBACK`: overlay **fade nhanh** (`--dur-fast`), giữ nội dung nền tĩnh (không unmount, để giữ tiến trình).

**2. Câu hỏi & lựa chọn:** khi `ANSWERING` mở, các `OptionButton` **stagger** vào (`delayChildren` 40ms/nút, `y 8→0`, `--dur-fast`). `:active` chạm → scale `.97` (150ms) — phản hồi tức thì (mục 1.1).

**3. Hiệu ứng ĐÚNG / SAI (khi `answerRevealed`):**
- Đúng: ô `correct` scale `1→1.06→1` + flash viền `--color-success` + ✔ vẽ nét (path draw, `--dur-base`); nền lóe `--shadow-glow`.
- Sai: ô `wrong` shake ngang `±6px` 2 nhịp (`--dur-fast`) + ✗ hiện; đồng thời ô đúng nhẹ nhàng sáng lên để chỉ đáp án đúng.
- `StatBar` %: width `0→pct%` tween `--dur-slow`.

**4. Tàu tiến (`ShipMap`, khi `leaderboardUpdate`):** tween `progress` từ `animateFrom[teamId]` → giá trị mới bằng `--ease-out`, `--dur-slow`→1.2s; để lại vệt sóng. Tàu **về cảng đích** ở `VICTORY`: pháo hoa/kho báu mở + `--shadow-glow`, ~1.2s.

**5. Lật Thẻ Tri Thức (`KnowledgeCard`):** `rotateY 0→180°`, `--dur-slow`, `--ease-out`, `transform-style: preserve-3d`; mặt sau `backface-hidden`. Chỉ lật khi vào phase `KNOWLEDGE_CARD`.

**6. Khoảnh khắc "lật kèo" (`LeaderboardList`):** dùng `layout` (FLIP) cho hàng đổi vị trí — hàng vượt lên nảy scale `1.08` + glow `--color-accent-500`, hàng bị vượt mờ nhẹ; `--dur-base`→slow. Kèm `ScorePopup` bay và (tùy chọn) âm `combo`.

**7. Đếm ngược (`Timer`):** ≤10s nhịp đập theo giây (`scale 1→1.05`, `--dur-fast`); ≤3s số `--text-9xl` (BIG SCREEN) pop mỗi giây + đổi `--color-danger`.

**8. BOSS:** `BOSS_INTRO` → `BossStormOverlay` mây tím `--color-boss` cuộn vào (~1s), badge "x2" nảy; nền câu boss có gợn bão nhẹ (tôn trọng reduced-motion).

**9. Reaction:** emoji bay `y 0→-160px, opacity 1→0, scale 1→1.4`, `--dur-slow`, ngẫu nhiên lệch x; giới hạn ~20 emoji đồng thời để không giật.

---

### D. Âm thanh & Haptic

Tất cả đi qua **một service** `src/shared/audio/feedback.ts` với công tắc người dùng (mặc định theo thiết bị):

```ts
interface FeedbackController {
  playSound(id: SoundId): void;
  vibrate(pattern: HapticId): void;   // navigator.vibrate; no-op nếu không hỗ trợ
  settings: { soundOn: boolean; hapticOn: boolean };  // lưu localStorage
}
type SoundId = "select" | "submit" | "correct" | "wrong" | "combo"
             | "tick" | "countdown3" | "bossIn" | "reveal" | "victory" | "join";
type HapticId = "tap" | "success" | "error" | "warning" | "boss";
```

**Bản đồ sự kiện → âm thanh / haptic:**

| Sự kiện nguồn | Âm thanh | Haptic (mobile) |
|---|---|---|
| Chạm chọn option / toggle | `select` | `tap` (10ms) |
| `submitAnswer` gửi thành công (`answerAck.received`) | `submit` | `tap` |
| `answerRevealed.yourResult.isCorrect === true` | `correct` | `success` (2 nhịp ngắn) |
| `answerRevealed.yourResult.isCorrect === false` | `wrong` | `error` (1 nhịp dài) |
| `streak` tăng (ComboMeter) | `combo` | `success` |
| `Timer` ≤10s mỗi giây | `tick` | — |
| `Timer` ≤3s | `countdown3` | `warning` mỗi giây |
| Vào phase `BOSS_INTRO` (`bossPhase`) | `bossIn` | `boss` (rung dài) |
| Vào `REVEAL`/`BOSS_REVEAL` | `reveal` | — |
| `VICTORY` / `gameEnded` | `victory` | `success` |
| Player mới vào (`playerList` tăng, chỉ HOST/SCREEN) | `join` | — |

**Quy tắc:**
- **Chủ yếu trên PLAYER** (điện thoại). BIG SCREEN chỉ phát `bossIn`/`reveal`/`victory`/`countdown3` (âm phòng). HOST tắt âm mặc định.
- **Tắt được hoàn toàn:** toggle Âm thanh / Rung trong menu; tôn trọng `prefers-reduced-motion` (giảm nhịp `tick`) và tự tắt haptic nếu `navigator.vibrate` không tồn tại.
- **Autoplay policy:** khởi tạo `AudioContext` sau tương tác đầu tiên (nút "Vào phòng"); trước đó không phát.
- Ở `mode==="fallback"`: chỉ giữ `correct`/`wrong`/`countdown3`, tắt phần trang trí để giảm tải.

---

### E. Responsive

**PLAYER — điện thoại dọc (mặc định `< 640px`, `sm`):**
- Layout dọc: `PhaseBanner`/`ConnectionBanner` đỉnh → nội dung câu hỏi giữa (cuộn dọc nếu dài) → `ActionBar` neo đáy cố định ≥56px. Chỉ **một việc mỗi màn** (mục 1.1).
- Chữ: câu hỏi `--text-xl`, option `--text-lg`, thân min `--text-base` (16px). Nút chính full-width trừ padding `--space-4`.
- **Safe-area:** `padding-bottom: max(--space-4, env(safe-area-inset-bottom))`, tương tự top cho tai thỏ. `ActionBar` không bị che bởi thanh trình duyệt (dùng `100dvh`).
- **Xoay ngang:** phát hiện `orientation: landscape` trên phone → overlay nhẹ "Xoay dọc để chơi tốt hơn" (không chặn cứng; DnD/Matching vẫn hoạt động nếu người dùng bỏ qua). Ở `sm` landscape/phablet cho phép 2 cột option.

**BIG SCREEN — TV 16:9 (`≥ 1280px` `xl`, tối ưu `tv` 1920):**
- Khung cố định 16:9, căn giữa, letterbox nếu tỉ lệ khác. `data-theme="dark"` bật ở root `/present`.
- Vùng: header trạm (`StationBadge` banner) + `Timer` giant góc phải; trung tâm `prompt` `--text-5xl→7xl`; đáy `ShipMap` + `LeaderboardList` (điểm `--text-8xl`).
- **Không cuộn** — mọi thứ vừa 1 khung; nếu tràn → giảm số hàng leaderboard (`maxRows`) chứ không thu chữ dưới `--text-2xl` (min thân TV).
- Không tương tác, không safe-area (màn full).

**TEACHER CONSOLE — laptop ngang (`≥ 1024px` `lg`):**
- Lưới 3 cột: (trái) trạng thái phòng + `PhaseBanner` chi tiết + số đã trả lời live (`answerLocked.answeredCount/totalPlayers`); (giữa) preview câu hỏi/đáp án; (phải) hàng nút điều phối lớn theo dòng chảy mục 1.3.
- Mật độ cao, nút ≥44px nhưng gọn; luôn thấy deadline còn lại + `mode` + số kết nối. Dưới `lg` → cảnh báo "Dùng màn rộng hơn để điều phối".

**Chung:**
- Ảnh/bản đồ `max-width:100%`, dùng flex/grid + đơn vị tương đối; **không** để body cuộn ngang (nội dung rộng như bảng cuộn trong khung `overflow-x:auto` riêng).
- Test tối thiểu ở 360×640 (player), 1366×768 (host), 1920×1080 (screen).

---

### F. Accessibility

- **Tương phản:** chữ trên nền tối (BIG SCREEN) ratio ≥ **7:1** (mục 1.2); `--color-text-on-dark` trên `--color-bg-dark`. UI player ≥ 4.5:1. Không dùng chữ mảnh: nội dung lớn weight ≥ `--fw-semibold`.
- **Cỡ chữ tối thiểu:** player thân ≥ `--text-base` (16px); BIG SCREEN thân ≥ `--text-2xl` (24px). Không xuống dưới các mốc này khi thu gọn.
- **Vùng chạm ≥ 44×44px** (WCAG) cho mọi phần tử tương tác: `OptionButton`, `TrueFalseRow` toggle, `DropBucket`/endpoint `MatchPair`, `ReactionBar`, nút host.
- **Không chỉ dựa vào màu** để báo đúng/sai: `correct` luôn kèm **icon ✔ + chữ "Đúng"**, `wrong` kèm **icon ✗ + chữ "Sai"**; đội phân biệt bằng **màu + tên đội** (mục 3.2 chọn hue cách đều, phân biệt cả khi mù màu).
- **Screen reader (mức cơ bản):**
  - `Timer`: `role="timer"` + `aria-live="off"` (tránh spam), mốc 10s/3s dùng `aria-live="assertive"` một lần.
  - `OptionButton`: `role="radio"` trong `role="radiogroup"`; `TrueFalseRow`: `role="switch"` `aria-checked`. Trạng thái reveal thêm `aria-label` "Đúng/Sai".
  - `ConnectionBanner`/`errorEvent`: `role="status"`/`role="alert"` theo mức độ.
  - `PhaseBanner` cập nhật `aria-live="polite"` khi phase đổi.
  - Emoji reaction có `aria-hidden` (trang trí), không đọc từng cái.
- **Focus & bàn phím (host/laptop):** thứ tự tab hợp lý, focus ring rõ (`outline` `--color-primary-500`), nút bất khả hồi (Reveal/End) có xác nhận (mục 1.3).
- **Reduced motion:** token thời lượng về 0 → không parallax/rung; giữ cùng thông tin bằng đổi trạng thái tức thì.

---

### G. Edge case & trạng thái rỗng/lỗi

| Tình huống | Hành vi UI + component | Event / cơ chế |
|---|---|---|
| **Chờ câu hỏi** (giữa `STATION_OPEN`→`ANSWERING`) | `SkeletonBlock` cho prompt + option (shimmer, không giả nội dung) | chờ `stationOpened` |
| **Mạng chậm / tải lâu** | Skeleton + `ConnectionBanner status="reconnecting"`; nút giữ trạng thái `sending` cho tới `answerAck` | timeout mềm ~5s |
| **Mất mạng khi đang trả lời** | Overlay nhẹ "Mất kết nối — giữ nguyên đáp án & điểm"; `ConnectionBanner status="offline"` + nút "Thử lại" | tự `rejoin({reconnectToken})` |
| **Reconnect giữa câu** | Khôi phục **nguyên trạng**: câu hỏi + lựa chọn đã chọn (state cục bộ theo `questionId`) + `Timer` theo `deadlineTs` mới; nếu đã gửi thì giữ trạng thái `sent` | server bắn `roomState` + `stationOpened` + `timerSync`; `submitAnswer` **idempotent theo questionId** (không cộng đôi) |
| **Vào muộn** (join khi đã `ANSWERING`) | Nhận snapshot, vào thẳng câu hiện tại với thời gian còn lại thật; nếu vào sau `LOCKED` → hiển thị "Chờ câu kế", không cho gửi | `roomState.phase` + `timerSync` |
| **Hết giờ khi chưa trả lời** | `Timer` `expired` → khóa toàn bộ option (`disabled`), hiện "Hết giờ — chưa kịp trả lời"; **không** báo đúng/sai (chưa có `answerRevealed`) | server `LOCKED`; UI chỉ đổi trạng thái, không tự chấm |
| **Gửi trùng / spam nút** | Sau lần gửi đầu, nút `sending`→`sent`, khóa lựa chọn; các lần bấm sau bị chặn | `answerAck`; server lấy lần hợp lệ đầu trước deadline |
| **Nickname trùng** | `NicknameForm` báo inline `--color-warning` "Tên đã có người dùng, thử tên khác" | ack lỗi từ `setNickname`/`joinRoom` (`errorEvent`/ack `ok:false`) |
| **Sai mã phòng / phòng đóng** | Màn nhập lại mã, thông báo thân thiện "Không tìm thấy phòng ABCD" | `joinRoom` ack `ok:false, error` |
| **Nhận phase lạ / chưa hỗ trợ** | `SyncingScreen` "Đang đồng bộ…" thay vì crash | quy tắc mục 4.2 |
| **Chưa có ai vào** (LOBBY rỗng) | `QRPanel` lớn + "Đang chờ thí sinh…", counter `0/—` | `playerList.counts` |
| **Leaderboard chưa có điểm** | Hiển thị 6 đội điểm 0, tàu ở vạch xuất phát (progress 0) | `leaderboardUpdate` rỗng vẫn render khung |
| **PAUSED** | Overlay "Tạm dừng" phủ mọi app, freeze `Timer`, giữ nội dung nền | `roomState.phase==="PAUSED"`, `resumePhase` |
| **FALLBACK (mạng lỗi)** | Tắt animation nặng/emoji, `ConnectionBanner status="fallback"`, chỉ giữ vòng hỏi–đáp–chấm | `modeChanged("fallback")` |
| **Không máy chiếu** | PLAYER tự render `ShipMap`/`LeaderboardList` thu nhỏ | `modeChanged("no-projector")`, đọc `leaderboardUpdate` |
| **Lỗi nghiêm trọng** (`errorEvent.fatal`) | Màn lỗi toàn phần + hướng dẫn F5/nhập lại mã; **không mất điểm** (server giữ state) | `errorEvent{fatal:true}` |

**Quy tắc chịu lỗi chung:** không bao giờ mất tiến trình khi F5 (khôi phục qua `reconnectToken` + snapshot); mọi thông báo lỗi bằng tiếng Việt thân thiện, có hành động kế tiếp rõ ràng; component luôn có nhánh render an toàn khi thiếu dữ liệu (validate `PublicQuestion` đủ trường trước khi render — mục 6, nếu thiếu → "Đang tải câu hỏi…").
