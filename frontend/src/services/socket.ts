
import { io } from "socket.io-client";

const socket = io("http://localhost:8000", {
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
