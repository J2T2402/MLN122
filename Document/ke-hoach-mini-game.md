# KẾ HOẠCH THIẾT KẾ MINI GAME ÔN TẬP
## "HÀNH TRÌNH ĐỊNH HƯỚNG — Vượt 5 Trạm Tri Thức"
### Chương 5: Kinh tế thị trường định hướng XHCN & các quan hệ lợi ích kinh tế ở Việt Nam

> **Người lập:** Senior BA · **Ngày:** 09/07/2026 · **Trạng thái:** Bản kế hoạch (chờ chốt phương án)
> **Mục tiêu tài liệu:** Làm rõ *làm game gì, cho ai, chơi thế nào, xây bằng gì, deploy ra sao, tốn bao nhiêu, mất bao lâu, rủi ro gì*.

---

## 1. TÓM TẮT ĐIỀU HÀNH (Executive Summary)

| Hạng mục | Nội dung |
|---|---|
| **Sản phẩm** | Mini game web (chơi trên trình duyệt điện thoại/laptop, **không cài app**), tự xây, deploy lên server riêng + domain riêng. |
| **Mục đích** | Sinh viên **chơi để ôn/kiểm tra** lại nội dung đã thuyết trình (5.1.1 → 5.2 + tình huống Nhà ở xã hội). |
| **Quy mô** | ~30 người chơi đồng thời/lớp; thời lượng chơi trong tiết **15–25 phút**; giáo viên điều phối. |
| **Thể loại chọn** | Game phiêu lưu **theo 5 trạm + 1 trận Boss**, quiz realtime đa thể thức, đua tàu theo đội trên bản đồ. |
| **Công nghệ khuyến nghị** | React + Vite (frontend) · Node.js + Socket.io (realtime) · dữ liệu câu hỏi để trong file JSON, **không cần database**. |
| **Chi phí** | Từ **~0đ** (free-tier để demo) đến **~400.000–500.000đ** (domain .com 1 năm + 1 tháng hosting ổn định cho buổi thật). |
| **Thời gian xây** | ~**2 tuần** (nhóm 2–3 người) đến **~3–4 tuần** (1 người). MVP tối thiểu có thể xong trong ~1 tuần. |
| **Rủi ro lớn nhất** | (1) Server "ngủ" gây trễ đầu giờ; (2) wifi lớp yếu; (3) nội dung chính trị phải chuẩn 100%. → đều đã có biện pháp giảm thiểu. |

**Khuyến nghị của BA:** Xây theo hướng **MVP trước** (quiz realtime + trắc nghiệm + Đúng/Sai chạy ổn định cho 30 máy), sau đó bổ sung kéo-thả, bản đồ đua tàu và trận Boss Nhà ở xã hội. Dùng hosting **trả phí always-on** (~150k/tháng) cho buổi chạy thật để loại rủi ro "server ngủ".

---

## 2. BỐI CẢNH & PHẠM VI (Scope)

### 2.1. Vấn đề cần giải quyết
Sau khi thuyết trình Chương 5, cần một công cụ giúp sinh viên **ôn lại và tự kiểm tra** kiến thức một cách **sôi nổi** thay vì hỏi–đáp khô khan. Yêu cầu là **game tự xây, deploy lên server + domain riêng** (không dùng Kahoot/Quizizz có sẵn) để chủ động về nội dung, thương hiệu và trải nghiệm.

### 2.2. Trong phạm vi (In-scope)
- Game web realtime cho ~30 người chơi/lớp, chơi qua trình duyệt.
- Bao phủ trọn vẹn nội dung: **5.1.1, 5.1.2, 5.1.3, 5.2 và tình huống NOXH**.
- Màn hình cho **sinh viên** (điện thoại) + màn **chiếu chung** (máy chiếu) + **console điều phối của giáo viên**.
- Deploy production lên domain riêng, có HTTPS.

### 2.3. Ngoài phạm vi (Out-of-scope) — giai đoạn đầu
- Tài khoản đăng nhập/hồ sơ người dùng lâu dài (chơi ẩn danh bằng nickname là đủ).
- Ứng dụng di động native (chỉ làm web responsive).
- Hệ thống quản trị nội dung (CMS) phức tạp — giai đoạn đầu sửa câu hỏi trực tiếp trong file JSON.

### 2.4. Giả định (Assumptions)
- **Đã có sẵn server + domain riêng** ✅ (đã xác nhận) → không cần mua/chọn hosting; chỉ cần deploy lên hạ tầng hiện có (xem Mục 6.6).
- Có ít nhất 1 người biết lập trình web cơ bản (hoặc nhờ được), HOẶC chấp nhận thuê/khoán.
- Lớp học có wifi/4G và (lý tưởng) 1 máy chiếu cho màn chung.

---

## 3. ĐỐI TƯỢNG & YÊU CẦU (Stakeholders & Requirements)

### 3.1. Các bên liên quan
| Bên | Vai trò | Nhu cầu chính |
|---|---|---|
| **Sinh viên (người chơi)** | ~30 người/lớp | Vào nhanh (quét QR), chơi vui, thấy điểm & thứ hạng ngay. |
| **Giáo viên (host/điều phối)** | 1 người | Toàn quyền mở/khóa trạm, chốt đáp án, dừng giảng, biết ngay lớp hiểu sai chỗ nào. |
| **Nhóm phát triển** | 1–3 người | Stack dễ làm, dễ deploy, dễ bảo trì, chi phí thấp. |

### 3.2. Yêu cầu chức năng (Functional)
- FR1: Tạo phòng → sinh mã 6 ký tự + QR; sinh viên vào bằng trình duyệt, đặt nickname.
- FR2: Chia 5–6 **đội** (tự động hoặc tự chọn), tên đội gợi nhớ bài (Đội Chủ Đạo, Đội Động Lực…).
- FR3: **Đồng bộ theo chặng**: giáo viên mở trạm → tất cả 30 máy nhận cùng thử thách cùng lúc, có đồng hồ đếm ngược.
- FR4: 5 thể thức thử thách map đúng 5 khối kiến thức (chi tiết Mục 5.3).
- FR5: Chấm điểm **phía server** theo đúng + tốc độ + combo; cộng điểm cá nhân → điểm đội.
- FR6: **Bản đồ đua tàu** + **bảng xếp hạng kép** (cá nhân & đội) trên màn chiếu.
- FR7: Lật **"Thẻ tri thức"** sau mỗi câu để lặp lại kiến thức + giáo viên chốt.
- FR8: **Console giáo viên**: điều phối, đổi chế độ, xem **bảng đo mức hiểu** của lớp theo từng chủ đề.

### 3.3. Yêu cầu phi chức năng (Non-functional)
- NFR1 **Hiệu năng**: mượt với 30 kết nối đồng thời (thực tế kiến trúc chịu 100–200).
- NFR2 **Chịu lỗi**: rớt mạng tự vào lại không mất điểm; có **chế độ fallback quiz thuần** khi WebSocket lỗi.
- NFR3 **Dễ dùng**: vào phòng < 30 giây, không cài app, thao tác chạm ngón tay dễ trên điện thoại.
- NFR4 **Bảo mật/chống gian lận**: đáp án chỉ ở server; xáo trộn thứ tự lựa chọn; khóa thời gian theo server.
- NFR5 **Chính xác nội dung**: 100% đáp án & giải thích phải được giảng viên duyệt.

---

## 4. CÁC PHƯƠNG ÁN THIẾT KẾ ĐÃ CÂN NHẮC & LÝ DO CHỌN

Đã phác thảo và so sánh **4 hướng game** theo các tiêu chí: *bám nội dung ôn tập · độ sôi nổi · khả thi cho 30 máy · phù hợp điều phối trong 15–25′ · công sức xây*.

| # | Hướng thiết kế | Điểm mạnh | Điểm yếu | Kết luận |
|---|---|---|---|---|
| A | **Quiz realtime thi đấu** (kiểu Kahoot tự xây) | Sôi nổi, dễ xây, chịu lỗi tốt | Đơn điệu, dễ học vẹt/đoán mò | Dùng làm **lõi MVP + fallback** |
| B | **Mô phỏng chính sách / nhập vai** (vào vai Nhà nước/DN/Dân giải bài NOXH) | Chiều sâu vận dụng, cảm xúc | Tổ chức nhập vai 30 người phức tạp, khó điều phối | Nhúng **thu nhỏ vào trận Boss** |
| C | **Game đội hợp tác–cạnh tranh** | Tinh thần đồng đội, chiến thuật | Dễ loạn nhịp với 30 máy | Lấy **cơ chế chia đội + đua** |
| D | **Phiêu lưu giải đố theo trạm** ✅ | **Bao phủ toàn bộ nội dung**, đa dạng thể thức (nhớ→hiểu→phân loại→vận dụng), giàu kịch tính | Công xây cao hơn | **CHỌN** — vì là *superset* gộp được điểm mạnh của A, B, C |

**→ Phương án chọn: Hướng D "Hành Trình Định Hướng".** Đây là lựa chọn tối ưu vì nó **không loại trừ** các hướng khác mà **hấp thụ** chúng: dùng engine quiz của (A) làm lõi, chia đội & đua của (C) làm động lực, và nhúng nhập vai NOXH của (B) vào trận Boss cuối. Nhờ 5 thể thức khác nhau, game ép sinh viên đi qua đủ 4 mức tư duy → **chống học vẹt và đoán mò**, đúng mục tiêu "chơi để ôn thật".

> *Lưu ý minh bạch: trong quá trình sinh ý tưởng, 3/4 bản phác thảo song song bị lỗi kết nối kỹ thuật; bảng so sánh trên dựng lại từ định hướng thiết kế ban đầu. Nếu bạn muốn, tôi có thể chạy lại để có bản đối chiếu 4 hướng đầy đủ bằng số liệu chấm điểm.*

---

## 5. ĐẶC TẢ GAME ĐƯỢC CHỌN

### 5.1. Ý tưởng cốt lõi
Cả lớp cầm lái **"con tàu kinh tế"**, được **"bàn tay Nhà nước"** dẫn dắt vượt **5 trạm tri thức** và **1 trận Boss "Cơn Bão Nhà Ở Xã Hội"**, để cập bến **"Dân giàu – Nước mạnh – Dân chủ – Công bằng – Văn minh"**. Chữ *"định hướng"* chơi chữ: vừa là *định hướng XHCN*, vừa là *lái tàu định hướng*.

### 5.2. Vòng chơi 1 trạm (Core loop – 6 bước)
1. Hệ thống mở trạm kế tiếp trên bản đồ; tàu mỗi đội neo trước cửa trạm.
2. 30 máy đồng loạt nhận thử thách riêng của trạm + đồng hồ đếm ngược (20–40s tùy thể thức).
3. Sinh viên trả lời độc lập trên máy mình; **đúng + nhanh + giữ combo** ⇒ điểm cao.
4. Hết giờ, server chốt đáp án, lật **"Thẻ tri thức"** tóm tắt cốt lõi + 1 dòng giải thích.
5. Điểm cá nhân cộng dồn thành điểm đội; tàu mỗi đội tiến thêm hải lý trên bản đồ.
6. Cập nhật bảng xếp hạng; giáo viên chốt/giảng nhanh rồi mở trạm tiếp. Lặp đủ 5 trạm → cao trào Boss.

### 5.3. Bản đồ 5 trạm + Boss (bám sát nội dung)
| Trạm | Tên | Nội dung | Thể thức | Mức tư duy |
|---|---|---|---|---|
| 1 | Đảo Khái Niệm | **5.1.1** Khái niệm KTTT định hướng XHCN | Trắc nghiệm | Nhớ |
| 2 | Eo Biển Tất Yếu | **5.1.2** Tính tất yếu khách quan | Đúng/Sai (đánh vào ngộ nhận) | Hiểu |
| 3 | Quần Đảo Đặc Trưng | **5.1.3** 4 đặc trưng (mục tiêu/sở hữu/quản lý/phân phối) | Kéo-thả phân loại 4 ô | Phân loại |
| 4 | Cảng Thể Chế | **5.2** Hoàn thiện thể chế | Chọn/loại phương án SAI | Hiểu–phân biệt |
| Boss | Cơn Bão NOXH | **Tình huống Nhà ở xã hội** | Giải tình huống + ghép 3 công cụ + nhập vai (điểm **x2/x3**) | Vận dụng |

### 5.4. Ngân hàng câu hỏi (mẫu — đã bám giáo trình)
> Toàn bộ để trong `questions.json`, giảng viên duyệt trước khi chạy. MVP ~30 câu; bản đầy đủ 60–80 câu để chơi lại nhiều lớp không trùng.

1. **(Trạm 1 – Trắc nghiệm)** KTTT định hướng XHCN vận hành theo cơ chế nào? → **Đáp án C**: *theo các quy luật thị trường ĐỒNG THỜI có sự điều tiết của Nhà nước pháp quyền XHCN do Đảng Cộng sản lãnh đạo.*
2. **(Trạm 2 – Đúng/Sai)** "KTTT là sản phẩm riêng của CNTB nên VN không được dùng." → **SAI**: *KTTT là thành tựu chung của nhân loại; VN kế thừa vì phân bổ nguồn lực hiệu quả, thúc đẩy lực lượng sản xuất.*
3. **(Trạm 3 – Kéo-thả)** Ghép yếu tố vào 4 nhóm: [Kinh tế nhà nước chủ đạo, tư nhân là động lực]→**Sở hữu/Thành phần**; [Quản lý bằng pháp luật, chiến lược, quy hoạch]→**Quản lý**; [Chủ yếu theo kết quả lao động]→**Phân phối**; [Dân giàu, nước mạnh…]→**Mục tiêu**.
4. **(Trạm 4 – Chọn phương án SAI)** Đâu KHÔNG phải phương hướng hoàn thiện thể chế? → **"Xóa bỏ hoàn toàn kinh tế tư nhân"** (SAI — tư nhân là *một động lực quan trọng*).
5. **(Boss – Tình huống)** DN chỉ xây chung cư cao cấp, bỏ rơi người thu nhập thấp → (a) **Thất bại của thị trường** ("bàn tay vô hình" thất bại); (b) ghép **Đất đai** (miễn/giảm tiền sử dụng đất, giao đất sạch) · **Thuế** (giảm 50% VAT & TNDN) · **Lãi suất** (gói ưu đãi 4.8%/năm qua Ngân hàng CSXH).
6. **(Boss – Phân biệt)** Khác biệt cốt lõi về *mục đích*: **TBCN** = lợi nhuận/giá trị thặng dư tối thượng, mâu thuẫn đối kháng; **định hướng XHCN** = vẫn tôn trọng lợi nhuận nhưng mục tiêu cao nhất là **công bằng xã hội**, Nhà nước điều tiết bằng *công cụ kinh tế* chứ không ép hành chính.

### 5.5. Tính điểm & động lực (Engagement)
- Điểm theo **tốc độ** (nhanh + đúng, thưởng tối đa ~+50%) + **combo/streak** (x1.1 → trần x1.5).
- Điểm cá nhân → điểm đội → tàu chạy trên bản đồ; **Boss nhân x2 (x3 chế độ "lật kèo")** để đội sau vẫn có cơ hội.
- **Bảng xếp hạng kép** + khoảnh khắc "clutch/lật kèo" phóng to màn hình + huy hiệu theo trạm; reaction/emoji khi vào Boss.

### 5.6. Kịch bản buổi học 15–25′ (giáo viên điều phối)
`0–3′` mở phòng, chiếu QR, chia đội, giới thiệu hải trình → `3–5′` Trạm 1 → `5–8′` Trạm 2 (đính chính ngộ nhận) → `8–12′` Trạm 3 → `12–15′` Trạm 4 → `15–22′` **Boss NOXH** (nhân điểm) → `22–25′` chốt bảng xếp hạng, tàu vô địch cập bến, chiếu lại 5 Thẻ tri thức tổng kết.
> **Van điều tiết thời gian:** chế độ **LITE** (1 câu/trạm, hạ còn 3–4 trạm nếu chỉ có ~15′) ↔ **CHUẨN** (1–2 câu/trạm); có nút bỏ qua/tăng tốc.

---

## 6. KIẾN TRÚC KỸ THUẬT & TRIỂN KHAI

### 6.1. Stack khuyến nghị
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS (responsive điện thoại/laptop) + Framer Motion (hiệu ứng bản đồ, tàu đua). Build ra static rất nhẹ.
- **Backend realtime:** **Node.js + Socket.io** (trên Express/Fastify), **1 server duy nhất**, giữ trạng thái game **trong RAM** (mỗi buổi là phiên tạm). Ngân hàng câu hỏi để trong `questions.json` — **không cần database** để chạy.
- **Vì sao:** Socket.io phổ biến, tự reconnect, tự fallback long-polling nếu trường chặn WebSocket; với ~30 người **không cần** Redis/microservice/K8s. Gói cả frontend + backend trong 1 tiến trình ⇒ **deploy 1 URL, gắn 1 domain** đúng yêu cầu.
- **Thay thế:** Colyseus (game-server chuyên phòng chơi) nếu muốn giảm code đồng bộ. *Lưu ý:* serverless (Vercel) **không giữ WebSocket bền** → vẫn cần 1 server Node riêng cho realtime.

### 6.2. Cơ chế realtime (server-authoritative)
Server nắm quyền, tổ chức theo "room". Giáo viên phát sự kiện `open_station / lock_station / reveal_answer / next_station`. **Timer chuẩn theo server** (gửi mốc deadline tuyệt đối, client tự đếm ngược) để 30 máy đồng bộ, không lệch giờ. Client nộp → **chỉ server chấm & tính điểm** → broadcast bảng xếp hạng (throttle ~200–500ms để không spam mạng).

### 6.3. Phương án hosting (tham khảo) — *bạn đã có server riêng nên phần này chỉ để đối chiếu*
| Tầng | Nhà cung cấp | Ưu | Nhược | Chi phí |
|---|---|---|---|---|
| **Miễn phí** (dev/demo) | FE: Cloudflare Pages/Vercel/Netlify · BE: Render Free / Oracle Always Free / Fly.io | 0đ, đủ để dev & demo | Render Free "ngủ" sau 15′ → cold start 30–60s (rủi ro đầu giờ); Oracle phải tự dựng | **0đ** |
| **Giá rẻ, ổn định** ✅ *(khuyến nghị buổi thật)* | BE: Render Starter / Railway / Fly.io · FE free | **Luôn bật**, SSL tự động, gắn domain vài click, deploy từ GitHub | Trả phí; server ở SG/US → trễ ~50–150ms (quiz chịu được) | **~130–190k/tháng** |
| **VPS đặt tại VN** | Vietnix, AZDIGI, Tinohost, Viettel IDC / hoặc DigitalOcean | Trễ thấp nhất, toàn quyền | Phải tự dựng Node/PM2/Caddy/SSL/firewall | **~100–300k/tháng** |

### 6.4. Domain & HTTPS
- **Mua domain:** `.com` rẻ minh bạch ở Cloudflare Registrar/Porkbun/Namecheap (~260–310k/năm); `.vn` phải qua nhà đăng ký trong nước (cần CCCD, đắt hơn); đuôi rẻ `.xyz/.site` năm đầu chỉ ~30–90k.
- **Trỏ DNS:** khuyến nghị đưa domain về **Cloudflare** (DNS free + CDN + chống DDoS cơ bản). PaaS (Render/Railway/Fly): thêm domain trong dashboard → tạo CNAME/A tương ứng → **SSL tự cấp**. VPS: bản ghi A trỏ IP + **Caddy** tự lo Let's Encrypt.
- ⚠️ **Quan trọng:** site HTTPS thì WebSocket **bắt buộc chạy qua `wss://`**; nếu để sau Cloudflare proxy phải **bật WebSocket** và **không cache** đường `/socket.io`.

### 6.5. Mô hình dữ liệu (chủ yếu in-memory)
`Room` (mã join, trạng thái, trạm hiện tại) · `Player` (nickname đã escape, đội, điểm, streak, connected) · `Team` (điểm, vị trí tàu 0–100%) · `Question` (tĩnh trong JSON: type, prompt, options, đáp án, timeLimit, mapsTo, knowledgeCard) · `Submission` (đáp án, đúng/sai, thời gian phản hồi, điểm). *Tùy chọn* SQLite/Postgres chỉ khi muốn **xuất báo cáo CSV** sau buổi.

### 6.6. Triển khai lên SERVER & DOMAIN sẵn có ✅ *(tình huống của bạn)*
Vì đã có server + domain, việc còn lại chỉ là đưa game lên và trỏ tên miền. Checklist khi tới bước deploy:

**A. Trên server (giả định Linux VPS — nếu server bạn khác loại, báo tôi để chỉ chính xác):**
1. Cài **Node.js** (bản LTS) + **PM2** (giữ tiến trình chạy nền, tự khởi động lại). Nếu là shared hosting/cPanel thuần PHP thì **không chạy được Node/WebSocket** → cần VPS hoặc gói Node.
2. Đưa mã lên (git clone / rsync), `npm install`, `npm run build` (frontend), chạy backend bằng `pm2 start`.
3. Backend lắng nghe 1 cổng nội bộ (vd `:3000`) và **phục vụ luôn** file frontend đã build → chỉ 1 tiến trình.

**B. Reverse proxy + HTTPS + domain (mấu chốt cho WebSocket):**
4. Dựng **Caddy** (khuyến nghị — tự xin & tự gia hạn SSL Let's Encrypt, cấu hình 2–3 dòng) hoặc **Nginx + Certbot** đứng trước, trỏ domain của bạn về cổng `:3000`.
5. ⚠️ **Bắt buộc cấu hình proxy cho WebSocket**: chuyển tiếp header `Upgrade`/`Connection` (Nginx) để `wss://` hoạt động; site HTTPS thì WebSocket **phải** là `wss://`.
6. Trỏ **bản ghi A** của domain → **IP server** (thêm `AAAA` nếu có IPv6). Nếu đặt sau Cloudflare proxy: **bật WebSocket** và **không cache** đường `/socket.io`.

**C. Trước ngày chạy thật:**
7. Đặt biến môi trường (cổng, URL, mật khẩu console giáo viên) trong `.env` — không commit lên git.
8. **Load test** 30–40 client mô phỏng + **dry-run** trên chính wifi lớp; chuẩn bị checklist ngày chạy.

> Nhờ đã có sẵn hạ tầng, bạn **tiết kiệm phần lớn công GĐ5** (mua/trỏ domain, chọn hosting) trong timeline Mục 8, và **chi phí thêm gần như bằng 0**.

---

## 7. BẢO MẬT & CHỐNG GIAN LẬN
- **Đáp án chỉ ở server**, không gửi client trước khi giáo viên bấm *reveal* → không mở DevTools xem trước được.
- **Xáo trộn** thứ tự lựa chọn/thẻ kéo trên từng máy → "ngó bài" vô nghĩa.
- **Khóa thời gian theo server** (không tin đồng hồ client); **chốt 1 lần/câu**, không sửa.
- 1 nickname = 1 phiên (session token) chống mở nhiều máy; **bộ lọc nickname** + host kick được.
- Mã phòng 6 số + console giáo viên bảo vệ bằng URL/mật khẩu riêng; validate input server-side; HTTPS/WSS + CORS chỉ cho domain game; đặt sau Cloudflare chống DDoS.

---

## 8. KẾ HOẠCH TRIỂN KHAI (Timeline)
| GĐ | Nội dung | Thời lượng | Sản phẩm bàn giao |
|---|---|---|---|
| 0 | Chuẩn bị & scaffolding | 2–3 ngày | Lập repo, chốt stack, số hóa `questions.json`, giảng viên duyệt nội dung |
| 1 | Lõi realtime & phòng chơi | 4–5 ngày | Tạo/join phòng + QR, chia đội, console giáo viên, đồng bộ theo chặng, timer server, reconnect |
| 2 | Các thể thức & tính điểm | 5–7 ngày | 4 thể thức + Boss, điểm tốc độ/combo, chấm server-side |
| 3 | Bản đồ hải trình & trải nghiệm | 3–4 ngày | Đua tàu theo đội, xếp hạng kép, Thẻ tri thức, huy hiệu, âm thanh |
| 4 | Hoàn thiện & duyệt nội dung | 3–4 ngày | Tối ưu UX mobile (ô kéo-thả đủ lớn), responsive, giảng viên duyệt lại đáp án |
| 5 | Deploy, test tải & tổng duyệt | 2–3 ngày | Mua/trỏ domain, HTTPS/WSS, **load test 30–40 client mô phỏng**, dry-run wifi lớp, checklist |

**Tổng:** ~3–4 tuần cho 1 người; ~2 tuần cho nhóm 2–3 người. **Chiến lược MVP:** làm xong GĐ0–1 + trắc nghiệm/Đúng-Sai trước (đủ chơi), rồi bổ sung kéo-thả/bản đồ/Boss.

---

## 9. CHI PHÍ
**Bạn đã có sẵn server + domain → chi phí hạ tầng tăng thêm gần như bằng 0đ.** Chỉ còn công lập trình (nội bộ) hoặc chi phí khoán nếu thuê ngoài.

*Bảng dưới chỉ để tham khảo nếu sau này cần mở rộng / tách hạ tầng riêng (tỷ giá ~26.000đ/USD):*
| Kịch bản | Thành phần | Tổng |
|---|---|---|
| Free-tier | FE free + BE free | ~0đ |
| Trả phí always-on | Hosting ~130–190k/tháng + domain ~300k/năm | Tháng đầu ~400–500k |
| VPS Việt Nam | VPS 1–2GB + domain | ~130–330k/tháng |

---

## 10. RỦI RO & GIẢM THIỂU
| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Server free "ngủ" → trễ 30–60s đầu giờ | Cao | Dùng tier **always-on** hoặc **pre-warm** 5–10′ trước buổi |
| Wifi trường yếu / sinh viên rớt mạng | Cao | Auto-reconnect + fallback long-polling + giữ nguyên điểm |
| Kéo-thả khó thao tác trên điện thoại | TB | Ô đủ lớn, nút "Neo hàng" xác nhận, test trên máy thật |
| **Nội dung chính trị sai** → phản tác dụng | Cao | Giảng viên **duyệt 100%** đáp án & giải thích trước khi chạy |
| 15–25′ hơi gấp cho 5 trạm | TB | Chế độ LITE + nút bỏ qua/tăng tốc, hạ còn 3–4 trạm |
| Gian lận (xem trước/chia đáp án) | TB | Chấm server-side, xáo đáp án, khóa thời gian server |
| Phụ thuộc máy chiếu | Thấp | Chế độ "không cần máy chiếu": hiện bản đồ/xếp hạng trên điện thoại |
| "Vỡ trận" đúng ngày thật | Cao | **Bắt buộc load test** 30–40 client mô phỏng + dry-run trước |

---

## 11. TRẠNG THÁI QUYẾT ĐỊNH & BƯỚC TIẾP
| Quyết định | Trạng thái |
|---|---|
| Phạm vi giai đoạn này | ✅ **Chỉ lập kế hoạch** (chưa code) |
| Hosting & tên miền | ✅ **Đã có sẵn server + domain riêng** → xem checklist deploy Mục 6.6 |
| Ai xây / khi nào bắt đầu code | ⏳ Để mở — khi cần, có thể bắt đầu từ **MVP** (Phụ lục B) rồi mở rộng |
| Phạm vi bản đầu (khi code) | ⏳ Gợi ý: **MVP quiz realtime** trước cho chắc → bổ sung bản đồ đua + Boss nhập vai sau |

**Khi bạn muốn đi tiếp, tôi có thể:** (a) soạn đầy đủ ngân hàng câu hỏi `questions.json` để giảng viên duyệt; (b) dựng MVP mã nguồn chạy được; (c) viết hướng dẫn deploy chi tiết đúng loại server bạn đang có (cho tôi biết đó là VPS Linux / cPanel / dịch vụ nào).

---

## PHỤ LỤC A — Danh sách màn hình (Screens)
**Sinh viên:** Nhập mã/QR → Chọn đội → Sảnh chờ → 5 màn thử thách (MCQ, Đúng/Sai, Kéo-thả 4 ô, Chọn-loại, Boss + Rút thẻ vai trò) → Reaction/emoji.
**Chiếu chung:** Giới thiệu hải trình → Lật Thẻ tri thức → Kết quả câu + bản đồ → Leaderboard cá nhân → Leaderboard đội + bản đồ đua → Cập bến/Vô địch → Tổng kết 5 thẻ.
**Console giáo viên:** Điều phối (mở/khóa/chốt/tạm dừng, đổi LITE↔CHUẨN, tăng tốc) · **Bảng đo mức hiểu** theo chủ đề · Điều khiển hiệu ứng · Nút cứu hộ (skip/chơi lại/kết thúc sớm) · Chế độ fallback.

## PHỤ LỤC B — Phạm vi MVP tối thiểu
Engine speed-quiz ổn định (MCQ + tốc độ + combo, vừa là MVP vừa là fallback) · vào phòng QR + chia đội · đồng bộ theo chặng qua WebSocket · đủ 5 thể thức map 5 trạm · bản đồ đua theo đội · xếp hạng kép · Thẻ tri thức · console giáo viên cơ bản · `questions.json` ~30 câu đã duyệt · chế độ fallback + "không cần máy chiếu" · Boss x2 + tổng kết.
