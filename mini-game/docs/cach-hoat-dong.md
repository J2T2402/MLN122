# Cách hoạt động — Mini Game "Hành Trình Định Hướng"

> **Vượt 5 Trạm Tri Thức** · Ôn tập Chương 5 — Kinh tế thị trường định hướng XHCN (Kinh tế chính trị Mác–Lênin)
> Tài liệu mô tả cách vận hành thực tế của game (đã đối chiếu qua kiểm thử end-to-end). Xem thêm: [`fe-spec.md`](fe-spec.md), [`be-spec.md`](be-spec.md), [kế hoạch tổng thể](../../Document/ke-hoach-mini-game.md).

---

## 1. Ý tưởng cốt lõi

Cả lớp cùng lái **"con tàu kinh tế"**, được **"bàn tay Nhà nước"** dẫn dắt vượt **5 trạm tri thức + 1 trận Boss** để ôn và tự kiểm tra kiến thức Chương 5. Giáo viên (MC) điều phối, sinh viên chơi trên điện thoại, kết quả chiếu chung trên máy chiếu.

- **Chơi realtime**, không cài app — chỉ mở trình duyệt.
- Quy mô ~30 người/lớp, thời lượng **15–25 phút**.
- Đích đến: cập bến **"Dân giàu – Nước mạnh – Dân chủ – Công bằng – Văn minh"**.

---

## 2. Ba giao diện (3 vai trò)

| Vai trò | Đường dẫn | Thiết bị | Nhiệm vụ |
|---|---|---|---|
| **Người chơi** | `/play?room=MÃ` | Điện thoại | Vào phòng, trả lời câu hỏi, xem điểm & thứ hạng |
| **Màn chiếu** | `/present?room=MÃ` | Máy chiếu | Hiện câu hỏi, đáp án, bảng xếp hạng, đua tàu |
| **MC / Giáo viên** | `/host` | Laptop | Tạo phòng và điều phối toàn bộ buổi chơi |

Ba màn hình được **đồng bộ realtime** với nhau qua server: MC bấm nút ở console, câu hỏi/đáp án/xếp hạng hiện ngay trên mọi điện thoại và máy chiếu cùng lúc.

---

## 3. Luồng chơi từng bước

### 3.1. Chuẩn bị & vào phòng

1. **MC** mở `/host` → bấm **"Tạo phòng học mới"** → server sinh **mã phòng 4 ký tự** + khóa bí mật (host token). MC chọn chế độ:
   - **CHUẨN** — có lật *Thẻ tri thức* sau mỗi câu.
   - **RÚT GỌN** — bỏ lật thẻ để tiết kiệm thời gian.
2. **Sinh viên** mở `/play?room=MÃ` → nhập **mã PIN 4 ô** (mã tự điền sẵn nếu vào bằng link/QR) → **đặt tên + chọn linh vật** → vào sảnh chờ.
3. **Màn chiếu** mở `/present?room=MÃ` → hiện mã phòng lớn + danh sách thủy thủ đang lên tàu.
4. MC bấm **"Khởi hành"** → sinh viên **chọn 1 trong 6 đội**, rồi bấm xác nhận *"Vào đội"*:

   > 🔴 Hồng San Hô · 🟠 Cam Hải Đăng · 🟡 Vàng Cánh Buồm · 🟢 Lục Rong Biển · 🔵 Lam Sóng Bạc · 🟣 Tím Hải Vương

### 3.2. Vòng lặp mỗi trạm

MC bấm nút để chuyển pha; cả phòng đồng bộ theo:

```
Mở trạm            → câu hỏi hiện trên mọi máy + màn chiếu (chưa chạy giờ)
  ↓
Bắt đầu đồng hồ    → đếm ngược; sinh viên trả lời độc lập trên máy mình
  ↓
Khóa đáp án        → tự động khi đủ người nộp / hết giờ / MC bấm "Khóa"
  ↓
Công bố đáp án     → server chấm điểm; mỗi máy hiện Đúng/Sai + điểm + thống kê lớp;
                     màn chiếu hiện đáp án đúng + % lớp hiểu bài
  ↓
Lật Thẻ tri thức   → (chế độ CHUẨN) tóm tắt cốt lõi + giải thích
  ↓
Bảng xếp hạng      → xếp hạng kép (cá nhân + đội) + đua tàu trên bản đồ
  ↓
Sang trạm tiếp
```

### 3.3. Trận Boss & tổng kết

- Sau 4 trạm, MC bấm **"Ập vào trận Boss"** → màn chiếu hiện hiệu ứng *Cơn Bão Nhà Ở Xã Hội*.
- MC bắt đầu đồng hồ Boss → câu **tình huống vận dụng, điểm nhân ×2**.
- MC bấm **"Tổng kết & kết thúc"** → màn chiếu hiện **hạm đội vô địch + thủy thủ MVP + pháo giấy**; sinh viên thấy màn tổng kết.

### 3.4. Công cụ điều phối của MC

- **Tạm dừng / Tiếp tục** — dừng đồng hồ để giảng, khi tiếp tục đồng hồ được re-arm đúng thời gian còn lại.
- **Xem trước đáp án** — chỉ MC thấy đáp án đúng & phần giải thích.
- **Danh sách thủy thủ (roster)** — theo dõi ai đã vào, thuộc đội nào, điểm bao nhiêu, còn kết nối không.
- **Đóng phòng khẩn cấp** — kết thúc và xóa phiên.

---

## 4. Năm thể thức câu hỏi (bám nội dung)

| Trạm | Tên | Nội dung | Thể thức | Mức tư duy |
|---|---|---|---|---|
| 1 | Đảo Khái Niệm | 5.1.1 — Khái niệm | **Trắc nghiệm** (chọn 1 đáp án) | Nhớ |
| 2 | Eo Biển Tất Yếu | 5.1.2 — Tính tất yếu | **Đúng/Sai** (từng nhận định) | Hiểu |
| 3 | Quần Đảo Đặc Trưng | 5.1.3 — 4 đặc trưng | **Kéo-thả** phân loại 4 nhóm (chạm-để-xếp, hợp cảm ứng) | Phân loại |
| 4 | Cảng Thể Chế | 5.2 — Hoàn thiện thể chế | **Trắc nghiệm / chọn phương án SAI** | Hiểu–phân biệt |
| Boss | Cơn Bão NOXH | Tình huống Nhà ở xã hội | **Giải tình huống**, điểm **×2** | Vận dụng |

*Engine còn hỗ trợ 2 thể thức khác trong dữ liệu là "chọn phương án sai" (selectwrong) và "nối cặp" (matching); ngân hàng có 40 câu bám giáo trình.*

---

## 5. Cách tính điểm (chấm 100% ở server)

Điểm mỗi câu:

```
điểm = round( (điểm_nền × độ_đúng  +  thưởng_tốc_độ) × combo × hệ_số_Boss )
```

| Thành phần | Cơ chế |
|---|---|
| **Độ đúng** | Đúng hoàn toàn = 100%. Đúng/Sai và kéo-thả chấm **theo tỉ lệ** số ý đúng. |
| **Thưởng tốc độ** | Trả lời càng nhanh (còn nhiều thời gian) càng nhiều — **tối đa +50%** điểm nền. |
| **Combo / streak** | Đúng liên tiếp → nhân **1.1 → trần 1.5**. |
| **Hệ số Boss** | Câu Boss nhân **×2**. |
| **Sai / không nộp** | **0 điểm** và **mất combo** (streak về 0). |

**Ví dụ (đã kiểm chứng):** trả lời đúng + nhanh ở trạm 1 ≈ **1.650đ**; đúng câu Boss ×2 ≈ **6.746đ**.

Điểm cá nhân cộng dồn → **điểm đội** → **tàu chạy** trên bản đồ hải trình.

---

## 6. Bảng xếp hạng & đua tàu

- **Xếp hạng kép:**
  - *Cá nhân* — sắp theo điểm, rồi streak, rồi thời điểm vào phòng.
  - *Đội* — tổng điểm các thành viên.
- **Đua tàu:** mỗi đội là một con tàu, tiến theo công thức
  `tiến_độ = (số_trạm_đã_qua / 5) + thưởng_dẫn_điểm`
  và về đích **100%** khi cả buổi kết thúc (cập bến vô địch).

---

## 7. Cơ chế kỹ thuật & chống gian lận

**Kiến trúc**
- Realtime qua **Socket.io (WebSocket)**; server giữ **toàn bộ trạng thái trong RAM** (mỗi buổi là một phiên tạm, **không cần database**).
- Ngân hàng câu hỏi để trong `server/data/questions.json` — sửa trực tiếp, không đụng code.
- Một tiến trình phục vụ cả frontend đã build lẫn realtime → **1 URL, 1 domain**.

**Đồng bộ & chấm điểm**
- **Đồng hồ chuẩn theo server:** server gửi mốc deadline tuyệt đối, client tự đếm ngược → mọi máy đồng bộ, không lệch giờ.
- **Chấm điểm 100% ở server;** đáp án **không gửi xuống client** trước khi MC công bố.

**Chống gian lận**
- **Xáo trộn thứ tự đáp án theo TỪNG máy** (chống "ngó bài"), ổn định trong một câu.
- **Khóa theo giờ server** · **1 lần nộp/câu** (idempotent) · lọc nickname & từ cấm.
- Sinh viên **không thể gọi lệnh điều phối của MC** (kiểm tra quyền phía server).

**Chịu lỗi mạng**
- Rớt mạng **tự vào lại bằng reconnect token**, khôi phục câu hỏi đang chạy + đồng hồ và **giữ nguyên điểm**.
- Tự động khóa sớm khi tất cả người đã có đội đều nộp; hết giờ server tự khóa.

---

## 8. Ghi chú phiên bản hiện tại

- Mã phòng hiện là **4 ký tự** (dễ nhập trên điện thoại).
- Console MC hiện chơi **1 câu/trạm** (câu đầu của mỗi trạm) + 1 câu Boss. Ngân hàng còn nhiều câu dự phòng cho các lần chơi sau.
- Trước buổi chạy thật nên: **giảng viên duyệt lại 100% đáp án & giải thích**, và **load-test 30–40 máy + dry-run trên wifi lớp**.

---

*Tài liệu tạo từ kiểm thử end-to-end thực tế (backend + frontend trên laptop, máy chiếu và điện thoại).*
