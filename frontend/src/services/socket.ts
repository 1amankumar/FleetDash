import { io } from "socket.io-client";
import API_BASE_URL from "../config/api";

const socket = io(API_BASE_URL, {
  autoConnect: true,
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Connected to FleetDash Socket.IO:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Socket.IO connection failed:", error.message);
});

export default socket;