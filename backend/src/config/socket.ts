import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

let io: Server | null = null;

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Dashboard client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("Dashboard client disconnected:", socket.id);
    });
  });

  return io;
}

export function getSocketServer(): Server {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
}