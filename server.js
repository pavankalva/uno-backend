import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";
import { createRoom, joinRoom, getRoom, removePlayer, listRooms } from "./rooms.js";
import { initGameForRoom, playCard, drawCardForPlayer, getPublicGameState } from "./gameLogic.js";

const SECRET = "replace-this-with-a-secure-secret";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.post("/api/auth", (req, res) => {
  const { username } = req.body;
  if(!username || username.trim().length < 1) return res.status(400).json({ error: "Username required" });
  const user = { id: nanoid(8), username: username.trim() };
  const token = jwt.sign(user, SECRET, { expiresIn: "7d" });
  res.json({ token, user });
});

app.get("/api/rooms", (req,res) => {
  res.json(listRooms());
});

io.use((socket, next) => {
  // optional token auth on socket (if provided)
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    const user = jwt.verify(token, SECRET);
    socket.user = user;
    next();
  } catch (e) {
    next();
  }
});

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);
  // create room
  socket.on("createRoom", ({ mode="private", maxPlayers=4, difficulty="easy", username }, cb) => {
    const user = socket.user ?? { id: nanoid(8), username: username || "Host" };
    const code = createRoom(user, maxPlayers, difficulty, mode);
    socket.join(code);
    // init game state
    initGameForRoom(code);
    io.to(code).emit("roomUpdate", getPublicGameState(code));
    cb?.({ roomCode: code });
  });

  socket.on("joinRoom", ({ roomCode, username }, cb) => {
    const user = socket.user ?? { id: nanoid(8), username: username || "Player" };
    const joined = joinRoom(roomCode, user);
    if(!joined.success) return cb?.({ error: joined.message });
    socket.join(roomCode);
    io.to(roomCode).emit("roomUpdate", getPublicGameState(roomCode));
    cb?.({ success: true });
  });

  socket.on("startGame", ({ roomCode }, cb) => {
    const room = getRoom(roomCode);
    if(!room) return cb?.({ error: "Room not found" });
    initGameForRoom(roomCode);
    io.to(roomCode).emit("roomUpdate", getPublicGameState(roomCode));
    cb?.({ started: true });
  });

  socket.on("playCard", ({ roomCode, playerId, card }, cb) => {
    const result = playCard(roomCode, playerId, card);
    io.to(roomCode).emit("roomUpdate", getPublicGameState(roomCode));
    cb?.(result);
  });

  socket.on("drawCard", ({ roomCode, playerId }, cb) => {
    const card = drawCardForPlayer(roomCode, playerId);
    io.to(roomCode).emit("roomUpdate", getPublicGameState(roomCode));
    cb?.({ card });
  });

  socket.on("getState", ({ roomCode }, cb) => {
    cb?.(getPublicGameState(roomCode));
  });

  socket.on("disconnecting", () => {
    // remove player references
    removePlayer(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("UNO server running on port", PORT));