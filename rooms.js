import { nanoid } from "nanoid";

const rooms = {};

export function createRoom(hostUser, maxPlayers=4, difficulty="easy", mode="private") {
  const code = generateRoomCode();
  rooms[code] = {
    code,
    mode,
    difficulty,
    maxPlayers,
    host: hostUser,
    players: [{ id: hostUser.id, username: hostUser.username, socketId: null }],
    createdAt: Date.now(),
    game: null
  };
  return code;
}

export function joinRoom(code, user) {
  const room = rooms[code];
  if(!room) return { success:false, message: "Room not found" };
  if(room.players.find(p=>p.id===user.id)) return { success:true };
  if(room.players.length >= room.maxPlayers) return { success:false, message: "Room full" };
  room.players.push({ id: user.id, username: user.username, socketId: null });
  return { success:true };
}

export function getRoom(code) {
  return rooms[code];
}

export function removePlayer(socketId) {
  // clean up any player entries that match socketId
  for(const code of Object.keys(rooms)) {
    const room = rooms[code];
    room.players = room.players.filter(p => p.socketId !== socketId);
    if(room.players.length === 0) delete rooms[code];
  }
}

export function listRooms() {
  return Object.values(rooms).map(r => ({ code: r.code, mode: r.mode, players: r.players.length, maxPlayers: r.maxPlayers }));
}

function generateRoomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  // avoid collisions (very unlikely)
  if(rooms[code]) return generateRoomCode();
  return code;
}