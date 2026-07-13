// PM2 process config cho MLN122 backend.
// Chạy:  pm2 start deploy/ecosystem.config.js   (từ thư mục mini-game/)
//
// QUAN TRỌNG: instances=1 / fork — state game giữ trong RAM nên CHỈ chạy 1 tiến trình,
// TUYỆT ĐỐI không dùng cluster (-i) vì mỗi worker sẽ có state riêng, phòng sẽ "lạc" nhau.
const path = require("path");

module.exports = {
  apps: [
    {
      name: "mln122",
      // cwd = server/ để ./data/questions.json và dotenv (.env) phân giải đúng.
      cwd: path.resolve(__dirname, "../server"),
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: "production" },
    },
  ],
};
