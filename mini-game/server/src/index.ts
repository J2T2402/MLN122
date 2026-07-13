import http from "http";
import { Server } from "socket.io";
import { config } from "./config/env";
import { loadQuestions } from "./questions/loader";
import { startJanitor } from "./rooms/janitor";
import { app } from "./http/app";
import { initSocketGateway } from "./socket/gateway";

function bootstrap() {
  console.log("=========================================");
  console.log("HÀNH TRÌNH ĐỊNH HƯỚNG — WEB MINI-GAME");
  console.log("Bootstrap starting...");
  console.log("=========================================");

  try {
    // 1) Load questions bank and validate
    loadQuestions();

    // 2) Create HTTP server wrapper
    const server = http.createServer(app);

    // 3) Create Socket.io server instance
    const io = new Server(server, {
      cors: {
        origin: config.corsOrigin,
        credentials: true,
      },
      pingTimeout: 10000,
      pingInterval: 5000,
    });

    // 4) Initialize Socket connection listeners
    initSocketGateway(io);

    // 5) Start active room GC janitor
    startJanitor();

    // 6) Open port
    server.listen(config.port, () => {
      console.log(`\nSUCCESS: Server running on port :${config.port}`);
      console.log(`CORS allowed origins: ${config.corsOrigin.join(", ")}\n`);
    });
  } catch (err) {
    console.error("BOOTSTRAP FAILED:", err);
    process.exit(1);
  }
}

bootstrap();
