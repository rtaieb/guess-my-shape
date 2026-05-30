import './style.css';
import { db } from './firebase';
import { ref, set, get, onValue, push, update, remove, onDisconnect } from 'firebase/database';
import type { Room, Stroke } from './types';
import { generateId, isGuessCorrect, getRandomPseudo } from './utils';
import { getRandomWord } from './words';

// State
let myId = localStorage.getItem('playerId') || generateId();
localStorage.setItem('playerId', myId);
let myName = localStorage.getItem('playerName'); // Intentionally undefined if none
let currentRoomId: string | null = null;
let currentRoom: Room | null = null;

// URL parameters
const urlParams = new URLSearchParams(window.location.search);
const initialRoomCode = urlParams.get('room') || '';

// DOM Elements
const appDiv = document.getElementById('app')!;

// Views
const renderLobbyJoin = () => `
  <div class="screen">
    <h1 class="title">Guess My Shape</h1>
    <div class="form-group">
      <label>Ton pseudo :</label>
      <div class="input-with-buttons">
        <input type="text" id="playerNameInput" value="${myName || getRandomPseudo()}" placeholder="Ex: Pikachou" />
        <button id="btnRandomPseudo" title="Changer aléatoirement">🎲</button>
        <button id="btnClearPseudo" title="Effacer">❌</button>
      </div>
    </div>
    <div class="form-group">
      <label>Code du salon :</label>
      <input type="text" id="roomCodeInput" value="${initialRoomCode}" placeholder="Laisser vide pour créer" />
    </div>
    <button id="btnJoinCreate">Créer / Rejoindre</button>
  </div>
`;

const renderLobbyRoom = (room: Room) => {
  const playersHtml = Object.entries(room.players).map(([id, p]) => `<li>${p.name} ${id === myId ? '(moi)' : ''} ${p.isHost ? '(Host)' : ''}</li>`).join('');
  const isHost = room.players[myId]?.isHost;
  return `
    <div class="screen lobby-container">
      <h2 class="title">Salon</h2>
      <div class="share-box">
        <button id="btnHome" style="margin-right: auto;" title="Quitter le salon">🏠</button>
        <span>Code: <b>${currentRoomId}</b></span>
        <button id="btnCopyCode" class="btn-large">📋 Code</button>
        <button id="btnCopyUrl" class="btn-large">📋 Lien</button>
      </div>
      <div class="players-list">
        <h3>Joueurs (${Object.keys(room.players).length})</h3>
        <ul>${playersHtml}</ul>
      </div>
      ${isHost ? `
        <div class="difficulty-presets">
          <button id="btnDiffFacile" class="btn-small">Facile</button>
          <button id="btnDiffClassique" class="btn-small">Classique</button>
          <button id="btnDiffDifficile" class="btn-small">Difficile</button>
        </div>
        <div class="form-group">
          <label>Traits max :</label>
          <input type="number" id="settingStrokes" value="${room.settings.maxStrokes}" min="2" max="20" />
        </div>
        <div class="form-group">
          <label>Temps (sec) :</label>
          <input type="number" id="settingTime" value="${room.settings.maxTime}" min="10" max="120" />
        </div>
        <button id="btnStartGame">Lancer la partie</button>
      ` : `
        <p>En attente du créateur pour lancer la partie...</p>
      `}
    </div>
  `;
};

const renderGame = (room: Room) => {
  const players = Object.values(room.players).sort((a, b) => b.score - a.score);
  const playersHtml = players.map(p => {
    const pId = Object.keys(room.players).find(k => room.players[k].name === p.name);
    const isMe = pId === myId;
    const isDrawer = p.name === room.players[room.currentRound!.drawerId].name;
    return `
      <li class="${isDrawer ? 'drawer-highlight' : ''}">
        ${p.name} ${isMe ? '(moi)' : ''} ${isDrawer ? '✏️' : ''} : ${p.score} pts
      </li>
    `;
  }).join('');
  
  const amIDrawer = room.currentRound!.drawerId === myId;
  const wordDisplay = amIDrawer || room.state === 'roundEnd' 
    ? room.currentRound!.word 
    : room.currentRound!.word.replace(/[a-zA-ZÀ-ÿ]/g, '_ ');

  const totalPlayers = Object.keys(room.players).length;
  const readyCount = room.readyPlayers ? room.readyPlayers.length : 0;
  const isReady = room.readyPlayers?.includes(myId);

  return `
    <div class="screen" style="max-width: 1000px">
      <div class="share-box" style="margin-bottom: 0.5rem">
        <button id="btnHome" style="margin-right: auto;" title="Quitter le salon">🏠</button>
        <span>Code: <b>${currentRoomId}</b></span>
        <button id="btnCopyCode" class="btn-large">📋 Code</button>
        <button id="btnCopyUrl" class="btn-large">📋 Lien</button>
      </div>
      <div class="game-header">
        <div id="wordDisplay">Mot: ${wordDisplay}</div>
        <div id="timerDisplay"></div>
        <div id="strokesDisplay">Traits: 0 / ${room.settings.maxStrokes}</div>
      </div>
      <div class="game-container">
        <div>
          <canvas id="gameCanvas" width="800" height="600"></canvas>
          ${room.state === 'roundEnd' ? `
            <div class="ready-panel">
              <button id="btnNextRound" ${isReady ? 'disabled' : ''}>Tour suivant (${readyCount}/${totalPlayers})</button>
              <div id="readyTimer">En attente...</div>
            </div>
          ` : ''}
        </div>
        <div class="sidebar">
          <div class="players-list">
            <h3>Scores</h3>
            <ul>${playersHtml}</ul>
          </div>
          <div class="chat-container">
            <div class="chat-messages" id="chatMessages"></div>
            <div class="chat-input">
              <input type="text" id="chatInput" placeholder="Devine le mot..." ${amIDrawer || room.state === 'roundEnd' ? 'disabled' : ''} />
              <button id="btnSendChat" ${amIDrawer || room.state === 'roundEnd' ? 'disabled' : ''}>Envoyer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Canvas variables
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let isDrawing = false;
let currentStroke: Stroke | null = null;
let strokesCount = 0;

function showToast(msg: string) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast!.classList.remove('show'), 2500);
}

function setupCopyButtons() {
  document.getElementById('btnCopyCode')?.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomId!);
    showToast("Code copié !");
  });
  document.getElementById('btnCopyUrl')?.addEventListener('click', () => {
    const url = window.location.origin + window.location.pathname + '?room=' + currentRoomId;
    navigator.clipboard.writeText(url);
    showToast("Lien copié !");
  });
  document.getElementById('btnHome')?.addEventListener('click', async () => {
    if (currentRoomId) {
      await remove(ref(db, `rooms/${currentRoomId}/players/${myId}`));
      currentRoomId = null;
      currentRoom = null;
      window.history.pushState({}, '', window.location.pathname);
      updateView();
    }
  });
}

function updateView() {
  let activeElementId = document.activeElement?.id;
  let chatInputValue = '';
  let chatInputSelectionStart: number | null = null;
  let chatInputSelectionEnd: number | null = null;

  if (activeElementId === 'chatInput') {
    const input = document.activeElement as HTMLInputElement;
    chatInputValue = input.value;
    chatInputSelectionStart = input.selectionStart;
    chatInputSelectionEnd = input.selectionEnd;
  }

  if (!currentRoom) {
    appDiv.innerHTML = renderLobbyJoin();
    document.getElementById('btnJoinCreate')!.onclick = handleJoinCreate;
    
    document.getElementById('btnRandomPseudo')?.addEventListener('click', () => {
      (document.getElementById('playerNameInput') as HTMLInputElement).value = getRandomPseudo();
    });
    document.getElementById('btnClearPseudo')?.addEventListener('click', () => {
      const input = document.getElementById('playerNameInput') as HTMLInputElement;
      input.value = '';
      input.focus();
    });
  } else if (currentRoom.state === 'lobby') {
    appDiv.innerHTML = renderLobbyRoom(currentRoom);
    setupCopyButtons();
    if (currentRoom.players[myId]?.isHost) {
      document.getElementById('btnStartGame')!.onclick = handleStartGame;
      
      document.getElementById('btnDiffFacile')?.addEventListener('click', () => {
        update(ref(db, `rooms/${currentRoomId}/settings`), { maxStrokes: 20, maxTime: 60 });
      });
      document.getElementById('btnDiffClassique')?.addEventListener('click', () => {
        update(ref(db, `rooms/${currentRoomId}/settings`), { maxStrokes: 15, maxTime: 45 });
      });
      document.getElementById('btnDiffDifficile')?.addEventListener('click', () => {
        update(ref(db, `rooms/${currentRoomId}/settings`), { maxStrokes: 7, maxTime: 30 });
      });

      document.getElementById('settingStrokes')!.onchange = (e) => {
        let val = +(e.target as HTMLInputElement).value;
        if (val < 2) val = 2;
        update(ref(db, `rooms/${currentRoomId}/settings`), { maxStrokes: val });
      };
      document.getElementById('settingTime')!.onchange = (e) => {
        let val = +(e.target as HTMLInputElement).value;
        if (val < 10) val = 10;
        update(ref(db, `rooms/${currentRoomId}/settings`), { maxTime: val });
      };
    }
  } else {
    // Game or RoundEnd
    appDiv.innerHTML = renderGame(currentRoom);
    setupCopyButtons();
    setupCanvas();
    setupChat();
    
    if (currentRoom.state === 'roundEnd') {
      document.getElementById('btnNextRound')!.onclick = async () => {
        const readyPlayers = currentRoom!.readyPlayers || [];
        if (!readyPlayers.includes(myId)) {
          const newReady = [...readyPlayers, myId];
          await set(ref(db, `rooms/${currentRoomId}/readyPlayers`), newReady);
        }
      };
    }
    
    // Timers
    if ((window as any).timerInt) clearInterval((window as any).timerInt);
    if (currentRoom.state === 'playing') {
      (window as any).timerInt = setInterval(updateTimer, 1000);
      updateTimer();
    } else if (currentRoom.state === 'roundEnd') {
      (window as any).timerInt = setInterval(updateReadyTimer, 1000);
      updateReadyTimer();
    }
  }

  if (activeElementId === 'chatInput') {
    const input = document.getElementById('chatInput') as HTMLInputElement;
    if (input && !input.disabled) {
      input.focus();
      input.value = chatInputValue;
      if (chatInputSelectionStart !== null) {
        input.setSelectionRange(chatInputSelectionStart, chatInputSelectionEnd);
      }
    }
  }
}

async function handleJoinCreate() {
  const nameInput = (document.getElementById('playerNameInput') as HTMLInputElement).value.trim();
  const roomInput = (document.getElementById('roomCodeInput') as HTMLInputElement).value.trim().toUpperCase();
  if (!nameInput) return alert("Veuillez entrer un pseudo");
  myName = nameInput;
  localStorage.setItem('playerName', myName);
  
  currentRoomId = roomInput || generateId().toUpperCase();
  const roomRef = ref(db, `rooms/${currentRoomId}`);
  
  try {
    const roomSnap = await get(roomRef);
    if (!roomSnap.exists()) {
      await set(roomRef, {
        state: 'lobby',
        settings: { maxStrokes: 15, maxTime: 45 },
        players: { [myId]: { name: myName, score: 0, isHost: true } }
      });
    } else {
      await update(ref(db, `rooms/${currentRoomId}/players/${myId}`), {
        name: myName, score: 0, isHost: false
      });
    }
  } catch (error: any) {
    console.error(error);
    alert("Erreur de connexion à Firebase : " + error.message);
    return;
  }
  
  // Setup disconnect
  onDisconnect(ref(db, `rooms/${currentRoomId}/players/${myId}`)).remove();
  
  // Listen
  onValue(roomRef, (snap) => {
    if (snap.exists()) {
      const oldState = currentRoom?.state;
      currentRoom = snap.val() as Room;
      if (!currentRoom.players || !currentRoom.players[myId]) {
        currentRoom = null;
        currentRoomId = null;
      }
      if (oldState !== 'playing' && currentRoom?.state === 'playing') {
        strokesCount = 0;
      }
      
      // Auto-start if everyone is ready
      if (currentRoom?.state === 'roundEnd' && currentRoom.players[myId]?.isHost) {
        const readyCount = currentRoom.readyPlayers ? currentRoom.readyPlayers.length : 0;
        const totalPlayers = Object.keys(currentRoom.players).length;
        if (readyCount > 0 && readyCount >= totalPlayers) {
          handleStartGame(); // everyone clicked ready!
        }
      }
      
      updateView();
      if (currentRoom?.state === 'playing' || currentRoom?.state === 'roundEnd') {
        drawAllStrokes();
        renderChat();
      }
    } else {
      currentRoom = null;
      currentRoomId = null;
      updateView();
    }
  });
}

async function handleStartGame() {
  if (!currentRoomId || !currentRoom) return;
  const playerIds = Object.keys(currentRoom.players);
  let nextDrawer = playerIds[0];
  if (currentRoom.currentRound) {
    const currentIndex = playerIds.indexOf(currentRoom.currentRound.drawerId);
    nextDrawer = playerIds[(currentIndex + 1) % playerIds.length];
  }
  
  await update(ref(db, `rooms/${currentRoomId}`), {
    state: 'playing',
    readyPlayers: [],
    roundEndTime: null,
    currentRound: {
      drawerId: nextDrawer,
      word: getRandomWord(),
      startTime: Date.now(),
      correctGuessers: []
    }
  });
  await remove(ref(db, `rooms/${currentRoomId}/currentRound/strokes`));
  await remove(ref(db, `rooms/${currentRoomId}/currentRound/chat`));
}

function updateTimer() {
  if (!currentRoom || currentRoom.state !== 'playing' || !currentRoom.currentRound) return;
  const elapsed = Math.floor((Date.now() - currentRoom.currentRound.startTime) / 1000);
  const remaining = Math.max(0, currentRoom.settings.maxTime - elapsed);
  
  const timerDisplay = document.getElementById('timerDisplay');
  if (timerDisplay) {
    if (remaining > 0) {
      timerDisplay.innerText = `Temps: ${remaining}s`;
    } else {
      timerDisplay.innerText = '';
    }
  }
  
  if (remaining === 0 && currentRoom.players[myId]?.isHost) {
    // End round logic, set end time for 10s delay
    update(ref(db, `rooms/${currentRoomId}`), { 
      state: 'roundEnd',
      roundEndTime: Date.now() + 10000 
    });
  }
}

function updateReadyTimer() {
  if (!currentRoom || currentRoom.state !== 'roundEnd') return;
  
  const timerDisplay = document.getElementById('readyTimer');
  if (!currentRoom.roundEndTime) {
    if (timerDisplay) timerDisplay.innerText = "";
    return;
  }
  
  const remaining = Math.max(0, Math.ceil((currentRoom.roundEndTime - Date.now()) / 1000));
  if (timerDisplay) timerDisplay.innerText = `Départ automatique dans ${remaining}s...`;
  
  if (remaining === 0 && currentRoom.players[myId]?.isHost) {
    handleStartGame();
  }
}

// Canvas
function setupCanvas() {
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) return;
  ctx = canvas.getContext('2d')!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (currentRoom?.currentRound?.drawerId === myId && currentRoom.state === 'playing') {
    canvas.onmousedown = startDrawing;
    canvas.onmousemove = draw;
    window.onmouseup = stopDrawing;
    
    // touch
    canvas.ontouchstart = (e) => { e.preventDefault(); startDrawing(e.touches[0]); };
    canvas.ontouchmove = (e) => { e.preventDefault(); draw(e.touches[0]); };
    window.ontouchend = stopDrawing;
  }
}

function getMousePos(evt: MouseEvent | Touch) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}

function startDrawing(evt: MouseEvent | Touch) {
  if (strokesCount >= currentRoom!.settings.maxStrokes) return;
  isDrawing = true;
  const pos = getMousePos(evt);
  // straight line mode: only keep start and end point
  currentStroke = { color: '#000', width: 5, points: [pos, pos] };
}

function draw(evt: MouseEvent | Touch) {
  if (!isDrawing || !currentStroke) return;
  const pos = getMousePos(evt);
  currentStroke.points[1] = pos; // update end point for straight line
  
  drawAllStrokes(); // redraw all previous strokes
  
  // draw the preview of the current straight line
  ctx.beginPath();
  ctx.lineWidth = currentStroke.width;
  ctx.strokeStyle = currentStroke.color;
  ctx.moveTo(currentStroke.points[0].x, currentStroke.points[0].y);
  ctx.lineTo(currentStroke.points[1].x, currentStroke.points[1].y);
  ctx.stroke();
}

async function stopDrawing() {
  if (!isDrawing || !currentStroke) return;
  isDrawing = false;
  
  // Only save if it's an actual line (start != end)
  const p1 = currentStroke.points[0];
  const p2 = currentStroke.points[1];
  if (p1.x !== p2.x || p1.y !== p2.y) {
    strokesCount++;
    const strokesDisplay = document.getElementById('strokesDisplay');
    if (strokesDisplay) strokesDisplay.innerText = `Traits: ${strokesCount} / ${currentRoom!.settings.maxStrokes}`;
    
    // Push to firebase
    await push(ref(db, `rooms/${currentRoomId}/currentRound/strokes`), currentStroke);
  } else {
    drawAllStrokes(); // clear the dot preview if no movement
  }
  
  currentStroke = null;
}

function drawAllStrokes() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!currentRoom?.currentRound?.strokes) return;
  const strokesObj = currentRoom.currentRound.strokes;
  
  // also update strokes count for display
  const totalStrokes = Object.keys(strokesObj).length;
  if (currentRoom.currentRound.drawerId !== myId) {
    const sDisp = document.getElementById('strokesDisplay');
    if (sDisp) sDisp.innerText = `Traits: ${totalStrokes} / ${currentRoom.settings.maxStrokes}`;
  } else {
    strokesCount = totalStrokes;
    const sDisp = document.getElementById('strokesDisplay');
    if (sDisp) sDisp.innerText = `Traits: ${strokesCount} / ${currentRoom.settings.maxStrokes}`;
  }
  
  Object.values(strokesObj).forEach(stroke => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color;
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    // Draw straight line directly to the last point
    const endPos = stroke.points[stroke.points.length - 1];
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();
  });
}

// Chat & Guessing
function setupChat() {
  const input = document.getElementById('chatInput') as HTMLInputElement;
  const btn = document.getElementById('btnSendChat') as HTMLButtonElement;
  if (!input || !btn) return;
  
  const send = () => {
    const text = input.value.trim();
    if (text) {
      input.value = '';
      handleGuess(text);
    }
  };
  btn.onclick = send;
  input.onkeypress = (e) => { if (e.key === 'Enter') send(); };
}

async function handleGuess(text: string) {
  if (!currentRoom || !currentRoomId || currentRoom.state !== 'playing' || !currentRoom.currentRound) return;
  const word = currentRoom.currentRound.word;
  const correctGuessers = currentRoom.currentRound.correctGuessers || [];
  
  if (isGuessCorrect(text, word) && !correctGuessers.includes(myId)) {
    const rank = correctGuessers.length + 1;
    let points = 0;
    if (rank === 1) points = 3;
    else if (rank === 2) points = 2;
    else if (rank === 3) points = 1;
    
    const updates: any = {};
    const newCorrect = [...correctGuessers, myId];
    updates[`rooms/${currentRoomId}/currentRound/correctGuessers`] = newCorrect;
    
    // update scores
    const myScore = (currentRoom.players[myId].score || 0) + points;
    const drawerId = currentRoom.currentRound.drawerId;
    const drawerScore = (currentRoom.players[drawerId].score || 0) + points;
    
    updates[`rooms/${currentRoomId}/players/${myId}/score`] = myScore;
    updates[`rooms/${currentRoomId}/players/${drawerId}/score`] = drawerScore;
    
    // Check round end
    const totalPlayers = Object.keys(currentRoom.players).length;
    if (newCorrect.length >= 3 || newCorrect.length >= totalPlayers - 1) {
      updates[`rooms/${currentRoomId}/state`] = 'roundEnd';
      updates[`rooms/${currentRoomId}/roundEndTime`] = Date.now() + 10000;
    }
    
    await update(ref(db), updates);
    
    // Send system chat
    await push(ref(db, `rooms/${currentRoomId}/currentRound/chat`), {
      authorId: 'system', authorName: 'System', text: `${myName} a trouvé le mot !`, timestamp: Date.now(), isSystem: true, isCorrect: true
    });
  } else {
    // Normal chat message
    await push(ref(db, `rooms/${currentRoomId}/currentRound/chat`), {
      authorId: myId, authorName: myName, text, timestamp: Date.now()
    });
  }
}

function renderChat() {
  const container = document.getElementById('chatMessages');
  if (!container || !currentRoom?.currentRound?.chat) return;
  
  const messages = Object.values(currentRoom.currentRound.chat).sort((a, b) => a.timestamp - b.timestamp);
  container.innerHTML = messages.map(m => {
    if (m.isSystem) return `<div class="message system ${m.isCorrect ? 'correct' : ''}">${m.text}</div>`;
    return `<div class="message"><span class="author">${m.authorName}:</span>${m.text}</div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

updateView();
