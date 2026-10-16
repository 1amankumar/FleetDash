
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
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
