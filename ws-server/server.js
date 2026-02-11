const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const port = process.env.PORT || 3001;

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join:event", (eventId) => {
    const room = `event:${eventId}`;
    socket.join(room);
    console.log(`${socket.id} joined ${room}`);
  });

  socket.on("leave:event", (eventId) => {
    const room = `event:${eventId}`;
    socket.leave(room);
    console.log(`${socket.id} left ${room}`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

app.post("/emit", (req, res) => {
  const { eventId, event, payload } = req.body;
  if (!eventId || !event) {
    return res.status(400).json({ error: "eventId and event are required" });
  }
  io.to(`event:${eventId}`).emit(event, payload);
  res.json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

server.listen(port, () => {
  console.log(`Socket.IO server listening on port ${port}`);
});
