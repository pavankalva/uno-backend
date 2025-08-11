const socket = io({
  auth: {}
});
let token = null;
let user = null;
let currentRoom = null;
let localPlayerId = null;

document.getElementById("btnJoin").onclick = async ()=>{
  const username = document.getElementById("username").value || "Guest";
  const mode = document.getElementById("mode").value;
  const roomcode = document.getElementById("roomcode").value.trim();

  // call auth to get token
  const resp = await fetch("/api/auth", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ username })});
  const data = await resp.json();
  token = data.token; user = data.user;
  socket.auth = { token };

  if(mode === "offline") {
    // quick local-only game via backend createRoom but mode offline
    socket.emit("createRoom", { mode:"offline", maxPlayers:4, difficulty:"easy", username }, (res)=>{
      currentRoom = res.roomCode;
      showLobby();
    });
  } else if(mode === "online") {
    socket.emit("createRoom", { mode:"online", maxPlayers:4, difficulty:"easy", username }, (res)=>{
      currentRoom = res.roomCode;
      showLobby();
    });
  } else {
    // private - if code provided join or create
    if(roomcode) {
      socket.emit("joinRoom", { roomCode: roomcode, username }, (res)=>{
        if(res?.error) {
          status(res.error);
        } else {
          currentRoom = roomcode;
          showLobby();
        }
      });
    } else {
      socket.emit("createRoom", { mode:"private", maxPlayers:4, difficulty:"easy", username }, (res)=>{
        currentRoom = res.roomCode;
        showLobby();
      });
    }
  }
};

document.getElementById("startBtn").onclick = ()=>{
  socket.emit("startGame", { roomCode: currentRoom }, (res)=>{
    // started
  });
};

document.getElementById("backBtn").onclick = ()=>{
  location.reload();
};

document.getElementById("btnDraw").onclick = ()=>{
  socket.emit("drawCard", { roomCode: currentRoom, playerId: localPlayerId }, (res)=>{
    log("Drew card: "+ JSON.stringify(res.card));
  });
};

socket.on("connect", ()=>{ console.log("connected", socket.id); });

socket.on("roomUpdate", (state)=>{
  // show players and basic info
  if(!state) return;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("lobby").classList.remove("hidden");
  document.getElementById("roomTitle").innerText = "Room: "+ state.id || "";
  const playersDiv = document.getElementById("playersList");
  playersDiv.innerHTML = "";
  (state.players || []).forEach(pid => {
    const d = document.createElement("div");
    d.innerText = pid;
    playersDiv.appendChild(d);
  });
  // show game info if started
  if(state.discardTop) {
    // move to game view
    document.getElementById("lobby").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    updateGame(state);
  }
});

function showLobby(){
  document.getElementById("login").classList.add("hidden");
  document.getElementById("lobby").classList.remove("hidden");
  document.getElementById("roomTitle").innerText = "Room: "+ currentRoom;
  document.getElementById("playersList").innerHTML = "<div>Waiting for players...</div>";
}

function updateGame(state){
  document.getElementById("currentInfo").innerText = "Turn: "+ state.currentPlayer;
  const discard = document.getElementById("discard");
  discard.innerHTML = "<div class='cardItem'>"+ (state.discardTop.color? state.discardTop.color+" "+(state.discardTop.value||state.discardTop.action||"") : (state.discardTop.action||"WILD")) +"</div>";
  const hand = document.getElementById("hand");
  hand.innerHTML = "";
  // attempt to show your hand if present - we don't have mapping to local player id (simple demo)
  // show counts
  const counts = state.handsCount || {};
  for(const pid of state.players){
    const d = document.createElement("div");
    d.innerText = pid + " (" + (counts[pid]||0) + " cards)";
    hand.appendChild(d);
  }
}

function status(txt){ document.getElementById("status").innerText = txt; }
function log(txt){ const l=document.getElementById("log"); l.innerText = txt + "\n" + l.innerText; }