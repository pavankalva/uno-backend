// Basic UNO rules engine (simplified but covers main mechanics)
import { nanoid } from "nanoid";

function createDeck() {
  const colors = ["red","yellow","green","blue"];
  const deck = [];
  // number cards
  colors.forEach(color => {
    deck.push({ type:"number", color, value:0, id:nanoid() });
    for(let v=1; v<=9; v++){
      deck.push({ type:"number", color, value:v, id:nanoid() });
      deck.push({ type:"number", color, value:v, id:nanoid() });
    }
    // action cards: skip, reverse, draw2 (two of each)
    for(let i=0;i<2;i++){
      deck.push({ type:"action", color, action:"skip", id:nanoid() });
      deck.push({ type:"action", color, action:"reverse", id:nanoid() });
      deck.push({ type:"action", color, action:"draw2", id:nanoid() });
    }
  });
  // wild cards
  for(let i=0;i<4;i++){
    deck.push({ type:"wild", action:"wild", id:nanoid() });
    deck.push({ type:"wild", action:"wild4", id:nanoid() });
  }
  return shuffle(deck);
}

function shuffle(arr) {
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

const rooms = {}; // local room state (game placed here)

export function initGameForRoom(code) {
  const room = roomsState[code] ?? {};
  const deck = createDeck();
  const players = globalRoomUsers(code);
  // deal 7 cards to each player
  const hands = {};
  players.forEach(p => {
    hands[p.id] = [];
    for(let i=0;i<7;i++) hands[p.id].push(deck.pop());
  });
  // start discard
  let top = deck.pop();
  // ensure top is not wild4 at start
  while(top.type==="wild" && top.action==="wild4") top = deck.pop();
  const game = {
    id: nanoid(),
    deck,
    discard: [top],
    hands,
    players: players.map(p=>p.id),
    currentIndex: 0,
    direction: 1,
    lastPlayed: null,
    startedAt: Date.now()
  };
  roomsState[code] = game;
  return game;
}

function globalRoomUsers(code) {
  const r = require("./rooms.js");
  const room = r.getRoom(code);
  if(!room) return [];
  return room.players;
}

export function playCard(code, playerId, card) {
  const game = roomsState[code];
  if(!game) return { error: "Game not started" };
  // validate turn
  const currentPlayerId = game.players[game.currentIndex];
  if(playerId !== currentPlayerId) return { error: "Not your turn" };
  // find card in player's hand
  const hand = game.hands[playerId];
  const idx = hand.findIndex(c => c.id === card.id);
  if(idx === -1) return { error: "Card not found in hand" };
  const top = game.discard[game.discard.length-1];
  // validate play
  if(!isValidPlay(card, top)) return { error: "Invalid play" };
  // play the card
  hand.splice(idx,1);
  game.discard.push(card);
  game.lastPlayed = card;
  // apply action effects
  applyCardEffect(game, card);
  // check winner
  if(hand.length === 0) {
    game.winner = playerId;
  } else {
    advanceTurn(game);
  }
  return { success: true };
}

export function drawCardForPlayer(code, playerId) {
  const game = roomsState[code];
  if(!game) return null;
  if(game.deck.length === 0) {
    // reshuffle discard except top
    const top = game.discard.pop();
    game.deck = shuffle(game.discard);
    game.discard = [top];
  }
  const card = game.deck.pop();
  game.hands[playerId].push(card);
  // if they drew and can play, they may play (frontend decides)
  return card;
}

function isValidPlay(card, top) {
  if(card.type === "wild") return true;
  if(card.color && top.color && card.color === top.color) return true;
  if(card.type === "number" && top.type === "number" && card.value === top.value) return true;
  if(card.type === "action" && top.type === "action" && card.action === top.action) return true;
  if(card.type === "action" && top.color && card.color === top.color) return true;
  return false;
}

function applyCardEffect(game, card) {
  switch(card.type) {
    case "action":
      if(card.action === "skip") advanceTurn(game);
      if(card.action === "reverse") game.direction *= -1;
      if(card.action === "draw2") {
        // next player draws 2
        const next = nextPlayerIndex(game);
        const pid = game.players[next];
        for(let i=0;i<2;i++) {
          game.hands[pid].push(game.deck.pop());
        }
        // skip them
        game.currentIndex = (next + 1) % game.players.length;
        return;
      }
      break;
    case "wild":
      if(card.action === "wild4") {
        const next = nextPlayerIndex(game);
        const pid = game.players[next];
        for(let i=0;i<4;i++) game.hands[pid].push(game.deck.pop());
        game.currentIndex = (next + 1) % game.players.length;
        return;
      }
      break;
  }
}

function nextPlayerIndex(game) {
  return (game.currentIndex + game.direction + game.players.length) % game.players.length;
}

function advanceTurn(game) {
  game.currentIndex = (game.currentIndex + game.direction + game.players.length) % game.players.length;
}

/* -- Public view helper -- */
export function getPublicGameState(code) {
  const game = roomsState[code];
  if(!game) return null;
  const safeHands = {};
  Object.keys(game.hands).forEach(pid => safeHands[pid] = game.hands[pid].map(c=>({ type:c.type, color:c.color, value:c.value, action:c.action, id:c.id })));
  return {
    id: game.id,
    players: game.players,
    discardTop: game.discard[game.discard.length-1],
    handsCount: Object.fromEntries(Object.entries(game.hands).map(([k,v])=>[k,v.length])),
    winner: game.winner ?? null,
    currentPlayer: game.players[game.currentIndex],
    direction: game.direction
  };
}

// internal room state store
const roomsState = {};