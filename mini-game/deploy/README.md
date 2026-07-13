# Deploy MLN122 lên DigitalOcean (Ubuntu + Caddy + subdomain)

Kiến trúc: **1 tiến trình Node** phục vụ cả frontend đã build lẫn WebSocket, đứng sau **Caddy** (HTTPS + wss tự động), trên **1 subdomain**. State giữ trong RAM → chỉ chạy **1 instance**.

Subdomain đã cấu hình sẵn trong các file: **`mln.aurabeur.site`**.

---

## 0. DNS
Tạo bản ghi **A**: `mln.aurabeur.site` → **IP public của droplet**.
- Nếu DNS ở **Cloudflare**: để **DNS only (mây xám)** khi setup lần đầu (Caddy tự xin SSL). Nếu muốn bật proxy (mây cam) sau đó: **bật WebSocket** và **không cache** đường `/socket.io`.
- Chờ DNS phân giải: `dig +short mln.aurabeur.site` phải ra IP droplet.

## 1. Cài Node LTS + PM2 + Caddy (chạy 1 lần, dùng sudo)
```bash
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm i -g pm2

# Caddy (kho chính thức)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

## 2. Lấy code + build
```bash
sudo mkdir -p /opt && cd /opt
sudo git clone https://github.com/J2T2402/MLN122.git
sudo chown -R $USER:$USER /opt/MLN122
cd /opt/MLN122/mini-game

( cd client && npm ci && npm run build )    # -> client/dist
( cd server && npm ci && npm run build )    # -> server/dist
```

## 3. Cấu hình .env (secret + domain)
```bash
cd /opt/MLN122/mini-game
cp deploy/env.production.example server/.env
nano server/.env      # điền HOST_TOKEN_SECRET (secret ngẫu nhiên) + CORS_ORIGIN=https://mln.aurabeur.site
```
Tạo secret mới nếu cần: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## 4. Chạy backend bằng PM2
```bash
cd /opt/MLN122/mini-game
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # chạy dòng lệnh nó IN RA để tự bật khi reboot
curl -s localhost:3000/healthz    # -> OK
```

## 5. Caddy (HTTPS + wss)
```bash
sudo cp /opt/MLN122/mini-game/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile      # đổi mln.aurabeur.site thành subdomain thật
sudo systemctl reload caddy
```

## 6. Firewall (ufw) — KHÔNG mở port 3000 ra ngoài
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
```

## 7. Nghiệm thu
```bash
curl -s https://mln.aurabeur.site/healthz     # -> OK (đã có SSL)
```
Mở trình duyệt:
- Console MC: `https://mln.aurabeur.site/host` → "TẠO PHÒNG HỌC MỚI" → lấy mã.
- Màn chiếu:  `https://mln.aurabeur.site/present?room=MÃ`
- Người chơi: `https://mln.aurabeur.site/play`

Kiểm tra WebSocket: DevTools → Network → lọc `socket.io` → phải thấy kết nối **wss** status **101**.

---

## Cập nhật code (mỗi khi có bản mới)
```bash
cd /opt/MLN122/mini-game && ./deploy/deploy.sh
```

## Lưu ý vận hành
- **State trong RAM**: `pm2 restart` / server crash / reboot → **mất hết phòng đang chạy**. Chỉ restart **giữa các buổi**, không restart giữa game.
- **Chỉ 1 instance** — không dùng `pm2 -i`/cluster.
- Log: `pm2 logs mln122`. Trạng thái: `pm2 status`.
- `questions.json` sửa trực tiếp trong `server/data/` rồi `pm2 restart mln122` (nạp lại ngân hàng câu hỏi).
