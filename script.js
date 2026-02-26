//  FIREBASE CONFIG
const firebaseConfig = {
apiKey: "AIzaSyConiSLhLecFUDzHG-6DklqI7Llu80Sj40",
authDomain: "dj-s-cricket-bingo.firebaseapp.com",
databaseURL: "https://dj-s-cricket-bingo-default-rtdb.firebaseio.com",
projectId: "dj-s-cricket-bingo",
storageBucket: "dj-s-cricket-bingo.firebasestorage.app",
messagingSenderId: "581834264834",
appId: "1:581834264834:web:999632d23795dacbde321b",
measurementId: "G-E8JW0QSLTT"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- AUDIO CONTROLLER ---
const AudioController = {
sounds: {
pop: new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"),
correct: new Audio("https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3"),
wrong: new Audio("https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3"),
win: new Audio("https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3"),
lose: new Audio("https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3")
},
play(key) {
try {
const s = this.sounds[key];
s.currentTime = 0;
s.volume = 0.4;
s.play().catch(() => { });
} catch (e) { }
}
};



const Commentator = {
wrong: [
"Did you just guess, or do you actually think they played together?",
"My grandmother could have found a better connection.",
"That was worse than a dropped catch in the slips.",
"Are you just clicking names you've seen in TV ads?"
],
skip: [
"Ah, the classic 'I only watch IPL' button.",
"Skipping? Bold strategy.",
"Cowardice is a valid tactic, I guess.",
"I'll pretend I didn't see that."
],
timeout: [
"Take your time. It's not like we're playing a T20.",
"Even the 3rd Umpire fell asleep waiting.",
"Did your Wi-Fi drop, or just your cricket knowledge?"
]
};

let roastTimer = null;

function triggerRoast(type) {
const toast = document.getElementById('roastToast');
if (!toast || !Commentator[type]) return;

clearTimeout(roastTimer);

const lines = Commentator[type];
toast.textContent = lines[Math.floor(Math.random() * lines.length)];

toast.classList.add('toast-visible');

roastTimer = setTimeout(() => {
toast.classList.remove('toast-visible');
}, 3000);
}

// --- CRICKET RANKS ---
function getCricketRank(score) {
if (score >= 14) return "🏏 GOD OF CRICKET";
if (score >= 11) return "International Legend";
if (score >= 8) return "IPL Superstar";
if (score >= 5) return "Ranji Hero";
if (score >= 1) return "Club Cricketer";
return "Gully Captain";
}

// --- ROBUST SEEDED RNG (Park-Miller) ---
// This ensures the "Random" shuffle is exactly the same for both players
class SeededRandom {
constructor(seed) {
// Ensure seed is a non-zero integer
this.seed = (seed % 2147483647);
if (this.seed <= 0) this.seed += 2147483646;
}
next() {
this.seed = (this.seed * 16807) % 2147483647;
return this.seed / 2147483647;
}
}

// =================================================
// 1. REMOTE GAME DATA
// =================================================

// =================================================
// 2. GAME STATE VARIABLES
// =================================================
let activePool = [];
let currentPlayer = null;
let gridData = [];
let score = 0;
let skipsLeft = 5;
let turnsLeft = 21;
let isGameOver = false;
let timerInterval = null;
let currentTime = 0;
let timeLimit = 0;
let gameStartTime = 0;
let usedTargets = new Set();
let gameMode = 'single';
let myPlayerId = null;
let roomCode = null;
let roomListener = null;
let rng = Math.random; // Default to random
let cachedOpponentData = null;
let pendingLevel = null;
let hasUsedFreeHit = false;
let dbPlayers = {};
let dbDifficulty = {};
let dbAssociations = {};
let isDataLoaded = false;
let isDailyMode = false;
let dailyUsername = "";
let dailyStartTime = 0;
let dailyTotalTime = 0;
let dailyDateKey = "";
let basePlayers = {};
let baseDifficulty = {};
let baseAssociations = {};

// UI Elements
const levelScreen = document.getElementById('levelSelection');
const gameArea = document.getElementById('gameArea');
const gridEl = document.getElementById('bingoGrid');
const targetEl = document.getElementById('targetPlayerHighlight');
const scoreEl = document.getElementById('scoreValue');
const turnsEl = document.getElementById('turnsValue');
const timerEl = document.getElementById('timerDisplay');
const messageEl = document.getElementById('messageArea');
const skipsSpan = document.getElementById('skipsCount');
const nextBtn = document.getElementById('nextTargetBtn');

const lobbyModal = document.getElementById('lobbyModal');
const roomCodeInput = document.getElementById('roomCodeInput');
const waitingScreen = document.getElementById('waitingScreen');
const displayRoomCode = document.getElementById('displayRoomCode');
const opponentBar = document.getElementById('opponentBar');
const roomInfoBar = document.getElementById('roomInfoBar');
const activeRoomCode = document.getElementById('activeRoomCode');

const rulesModal = document.getElementById('rulesModal');
const rulesOkBtn = document.getElementById('rulesOkBtn');
const usernameModal = document.getElementById('usernameModal');
const dailyUsernameInput = document.getElementById('dailyUsernameInput');
const dailyLeaderboard = document.getElementById('dailyLeaderboard');
const dailyLeaderboardList = document.getElementById('dailyLeaderboardList');

async function initGameData() {
try {
const playersSnap = await db.ref('players').once('value');
const difficultySnap = await db.ref('difficulty').once('value');
const associationsSnap = await db.ref('associations/merged').once('value');

dbPlayers = playersSnap.val() || {};
dbDifficulty = difficultySnap.val() || {};
dbAssociations = associationsSnap.val() || {};
basePlayers = dbPlayers;
baseDifficulty = dbDifficulty;
baseAssociations = dbAssociations;
isDataLoaded = true;
console.log('Game data loaded successfully from Firebase.');
} catch (error) {
console.error('Failed to load game data from Firebase:', error);
}
}

// =================================================
// 3. UI LISTENERS
// =================================================

// Single Player Buttons -> Open Rules
document.querySelectorAll('.level-btn').forEach(btn => {
btn.addEventListener('click', () => {
if (!isDataLoaded) {
alert("Loading game data, please wait...");
return;
}

deactivateDailyMode();
gameMode = 'single';
rng = Math.random; // Reset RNG
pendingLevel = btn.dataset.level;
rulesModal.classList.remove('hidden');
AudioController.play('pop');
});
});

// Multiplayer Button -> Open Rules
document.getElementById('multiplayerBtn').addEventListener('click', () => {
if (!isDataLoaded) {
alert("Loading game data, please wait...");
return;
}

deactivateDailyMode();
gameMode = 'multi';
rulesModal.classList.remove('hidden');
AudioController.play('pop');
});


// Daily Bingo Button -> Username prompt
document.getElementById('dailyBingoBtn').addEventListener('click', () => {
if (!isDataLoaded) {
alert("Loading game data, please wait...");
return;
}
usernameModal.classList.remove('hidden');
dailyUsernameInput.value = dailyUsername;
setTimeout(() => dailyUsernameInput.focus(), 0);
AudioController.play('pop');
});

document.getElementById('startDailyBtn').addEventListener('click', async () => {
const name = dailyUsernameInput.value.trim();
if (!name) {
alert("Please enter a username");
return;
}
dailyUsername = name.substring(0, 15);
usernameModal.classList.add('hidden');
isDailyMode = true;
gameMode = 'daily';
AudioController.play('pop');
await startDailyBingo();
});

// Rules OK Button
rulesOkBtn.addEventListener('click', () => {
rulesModal.classList.add('hidden');
AudioController.play('pop');

if (gameMode === 'multi') {
// If just starting Multiplayer flow, open Lobby
if (!roomCode) {
lobbyModal.classList.remove('hidden');
document.getElementById('lobbyOptions').classList.remove('hidden');
waitingScreen.classList.add('hidden');
}
} else if (pendingLevel) {
startGame(pendingLevel);
}
});

document.getElementById('closeLobbyBtn').addEventListener('click', () => {
lobbyModal.classList.add('hidden');
});

document.getElementById('createRoomBtn').addEventListener('click', createRoom);
document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
document.getElementById('cancelLobbyBtn').addEventListener('click', () => {
if (roomCode && myPlayerId) {
db.ref('rooms/' + roomCode + '/players/' + myPlayerId).remove();
}
location.reload();
});

// =================================================
// 4. MULTIPLAYER LOGIC
// =================================================

function createRoom() {
roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
myPlayerId = 'p1';

const seed = Math.floor(Math.random() * 1000000) + 1;

const roomData = {
code: roomCode,
seed: seed,
status: 'waiting',
createdAt: Date.now(),
players: {
p1: {
score: 0,
finished: false,
finishTime: null,
ready: true
},
p2: {
score: 0,
finished: false,
finishTime: null,
ready: false
}
}
};

db.ref('rooms/' + roomCode).set(roomData).then(() => {
showWaitingScreen();
listenToRoom();

// cleanup if creator disconnects
db.ref('rooms/' + roomCode + '/players/p1').onDisconnect().remove();
});
}


function joinRoom() {
roomCode = roomCodeInput.value.toUpperCase().trim();
if (roomCode.length !== 6) return alert("Invalid Code");

db.ref('rooms/' + roomCode).once('value', snapshot => {
const room = snapshot.val();
if (!room) return alert("Room not found");
if (room.status !== 'waiting') return alert("Game already started or full");

myPlayerId = 'p2';

db.ref('rooms/' + roomCode + '/players/p2').set({
score: 0, finished: false, ready: true
});
db.ref('rooms/' + roomCode).update({ status: 'active' });
db.ref('rooms/' + roomCode + '/players/p2').onDisconnect().remove();

listenToRoom();
});
}

function showWaitingScreen() {
document.getElementById('lobbyOptions').classList.add('hidden');
waitingScreen.classList.remove('hidden');
displayRoomCode.textContent = roomCode;
}

function listenToRoom() {
roomListener = db.ref('rooms/' + roomCode).on('value', snapshot => {
const room = snapshot.val();
if (!room) return;

// --- GAME START TRIGGER ---
if (room.status === 'active' && document.getElementById('gameArea').classList.contains('hidden')) {
// Force close all menus
lobbyModal.classList.add('hidden');
rulesModal.classList.add('hidden');
levelScreen.classList.add('hidden');
gameArea.classList.remove('hidden');

gameMode = 'multi';

// Setup Seeded RNG
const seed = room.seed || 12345; // Fallback safety
const seededRng = new SeededRandom(seed);
rng = () => seededRng.next();

opponentBar.classList.remove('hidden');
roomInfoBar.classList.remove('hidden');
activeRoomCode.textContent = roomCode;

startGame('medium');
}

const oppId = myPlayerId === 'p1' ? 'p2' : 'p1';
const oppData = room.players[oppId];

if (!oppData && room.status === 'active') {
handleGameComplete(true, "Opponent disconnected!");
db.ref('rooms/' + roomCode).off();
return;
}

if (oppData) {
cachedOpponentData = oppData;
document.getElementById('oppScore').textContent = oppData.score;

if (room.players[myPlayerId].finished && oppData.finished && isGameOver) {
const myData = room.players[myPlayerId];
if (myPlayerId === 'p1') determineWinner(myData, oppData);
else determineWinner(oppData, myData);
}
}
});
}

function updateMultiplayerState(isFinished = false) {
if (gameMode !== 'multi') return;
const finishTime = (Date.now() - gameStartTime) / 1000;
db.ref(`rooms/${roomCode}/players/${myPlayerId}`).update({
score: score,
finished: isFinished,
finishTime: isFinished ? finishTime : null
});
}

function determineWinner(p1, p2) {
db.ref(`rooms/${roomCode}`).update({
status: 'finished'
});

db.ref('rooms/' + roomCode).off();
let result = "";

const myData = myPlayerId === 'p1' ? p1 : p2;
const oppData = myPlayerId === 'p1' ? p2 : p1;

if (myData.score > oppData.score) result = "YOU WIN! 🏆";
else if (myData.score < oppData.score) result = "YOU LOSE 💀";
else {
const myTime = myData.finishTime || 9999;
const oppTime = oppData.finishTime || 9999;
result = (myTime < oppTime) ? "YOU WIN! ⚡" : "YOU LOSE 🐌";
}

const modal = document.getElementById('gameModal');
document.getElementById('modalTitle').textContent = result;
document.getElementById('modalMessage').innerHTML = `Your Score: ${myData.score}<br>Opponent: ${oppData.score}`;
document.getElementById('rankDisplay').textContent = getCricketRank(myData.score);

modal.classList.remove('hidden');
document.getElementById('modalRestartBtn').style.display = 'inline-block';
document.getElementById('shareBtn').style.display = 'inline-block';

if (result.includes("WIN")) AudioController.play('win');
else AudioController.play('lose');
}


function formatDailyDateKey() {
const now = new Date();
return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function setRuntimeGameData(players, difficulty, associations) {
dbPlayers = players || {};
dbDifficulty = difficulty || {};
dbAssociations = associations || {};
}


function deactivateDailyMode() {
if (!isDailyMode) return;
isDailyMode = false;
dailyDateKey = "";
dailyTotalTime = 0;
setRuntimeGameData(basePlayers, baseDifficulty,  baseAssociations);
}

async function startDailyBingo() {
dailyDateKey = formatDailyDateKey();

try {
    const deckSnap = await db.ref('dailyBingo/' + dailyDateKey + '/deck').once('value');
    const deck = deckSnap.val();

    if (!deck || !deck.players || !deck.difficulty || !deck.associations) {
        alert("Today's grid isn't ready yet!");
        deactivateDailyMode();
        gameMode = 'single';
        return;
    }

    setRuntimeGameData(deck.players, deck.difficulty, deck.associations.merged); 
    
    activePool = Object.keys(deck.players).map(id => ({ id, ...(deck.players[id] || {}) })).filter(player => player && player.id && player.name);

    turnsLeft = 16;
    skipsLeft = 0;
    hasUsedFreeHit = true; 

    const freeHitBtn = document.getElementById('freeHitBtn');
    freeHitBtn.disabled = true;
    nextBtn.disabled = true;
    nextBtn.innerHTML = "No Skips";
    skipsSpan.textContent = '0';

    dailyStartTime = Date.now();

    // --- THE SEED FIX: Ensures everyone globally gets the exact same Daily Grid! ---
    const today = new Date();
    const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const seededRng = new SeededRandom(dateSeed);
    rng = () => seededRng.next();
    // -----------------------------------------------------------------------------

    startGame('daily');
} catch (error) {
    console.error('Failed to load daily deck:', error);
    alert("Couldn't load Daily Bingo. Please try again.");
    deactivateDailyMode();
    gameMode = 'single';
    setRuntimeGameData(basePlayers, baseDifficulty, baseAssociations);
}
}

async function showDailyLeaderboard() {
const boardRef = db.ref('dailyBingo/' + dailyDateKey + '/leaderboard');
const snap = await boardRef.once('value');
const entriesRaw = snap.val() || {};
const entries = Object.values(entriesRaw)
.filter(e => e && typeof e.score === 'number' && typeof e.time === 'number')
.sort((a, b) => (b.score - a.score) || (a.time - b.time))
.slice(0, 10);

dailyLeaderboardList.innerHTML = '';
if (entries.length === 0) {
const li = document.createElement('li');
li.textContent = 'No scores yet. Be the first!';
dailyLeaderboardList.appendChild(li);
return;
}

entries.forEach(entry => {
const li = document.createElement('li');
li.textContent = `${entry.username || 'Anonymous'} — ${entry.score} pts (${entry.time.toFixed(1)}s)`;
dailyLeaderboardList.appendChild(li);
});
}

// =================================================
// 5. GAME LOGIC (Fixed & Robust)
// =================================================

function startGame(level) {
score = 0;
skipsLeft = isDailyMode ? 0 : 5;
turnsLeft = isDailyMode ? 16 : 21;
isGameOver = false;
usedTargets.clear();
gameStartTime = Date.now();
cachedOpponentData = null;
hasUsedFreeHit = isDailyMode;
document.getElementById('freeHitBtn').disabled = isDailyMode ? true : false;

scoreEl.textContent = score;
turnsEl.textContent = turnsLeft;
skipsSpan.textContent = skipsLeft;
nextBtn.disabled = isDailyMode;
nextBtn.innerHTML = isDailyMode ? "No Skips" : `Skip (<span id="skipsCount">${skipsLeft}</span>)`;
clearInterval(timerInterval);

// Populate Pool from Firebase difficulty buckets
const easyIds = dbDifficulty['easy'] || [];
const mediumIds = dbDifficulty['medium'] || [];
const hardIds = dbDifficulty['hard'] || [];

const mapIdsToPlayers = (ids) => ids
.map(id => ({ id, ...(dbPlayers[id] || {}) }))
.filter(player => player && player.id && player.name);

let poolSource = [];
if (level === 'easy') {
timeLimit = 0;
poolSource = [...mapIdsToPlayers(easyIds), ...mapIdsToPlayers(mediumIds).slice(0, 15), ...mapIdsToPlayers(hardIds).slice(0, 15)];
} else if (level === 'medium') {
timeLimit = 12;
poolSource = [...mapIdsToPlayers(mediumIds), ...mapIdsToPlayers(easyIds), ...mapIdsToPlayers(hardIds).slice(0, 10)];
} else if (level === 'hard') {
timeLimit = 7;
poolSource = [...mapIdsToPlayers(hardIds), ...mapIdsToPlayers(mediumIds), ...mapIdsToPlayers(easyIds).slice(0, 10)];
} else if (level === 'daily') {
timeLimit = 10;
poolSource = Object.keys(dbPlayers).map(id => ({ id, ...(dbPlayers[id] || {}) })).filter(player => player && player.id && player.name);
}

// Shuffle using current RNG (Math.random OR Seeded)
activePool = shuffle(poolSource);

// Deduplicate
activePool = activePool.filter((player, index, self) =>
index === self.findIndex((t) => (t.id === player.id))
);

// Ensure UI Switch
levelScreen.classList.add('hidden');
gameArea.classList.remove('hidden');
document.getElementById('gameModal').classList.add('hidden');
dailyLeaderboard.classList.add('hidden');
document.getElementById('rankDisplay').parentElement.classList.remove('hidden');
document.getElementById('modalMessage').classList.remove('hidden');
AudioController.play('pop');

generateGrid();
pickNextTarget();
}

// Fisher-Yates Shuffle using Custom RNG
function shuffle(array) {
let m = array.length, t, i;
while (m) {
i = Math.floor(rng() * m--);
t = array[m];
array[m] = array[i];
array[i] = t;
}
return array;
}

function generateGrid() {
gridEl.innerHTML = "";
gridData = [];

const uniquePool = activePool.filter((player, index, self) =>
index === self.findIndex((t) => (t.id === player.id))
);

if (uniquePool.length < 16) {
handleGameComplete(false, "Not enough player data loaded!");
return;
}

const selectedGridPlayers = shuffle([...uniquePool]).slice(0, 16);

selectedGridPlayers.forEach((player, index) => {
const cellData = { id: player.id, index, content: player.name, clicked: false, status: null };
gridData.push(cellData);

const cell = document.createElement('div');
cell.classList.add('grid-cell');
cell.textContent = player.name;
cell.addEventListener('click', () => handleCellClick(cell, cellData));
gridEl.appendChild(cell);
});
}

function pickNextTarget() {
  clearInterval(timerInterval);
  if (isGameOver) return;

  const unclicked = gridData.filter(c => !c.clicked);
  
  // In daily mode, we run out when unclicked is 0.
  if (!isDailyMode && unclicked.length === 0) {
      handleGameComplete(true);
      return;
  }
  if (turnsLeft <= 0) {
      handleGameComplete(false, "Ran out of turns!");
      return;
  }

  // --- THE TARGET FIX: Never pick a player sitting on the grid ---
  const gridIds = new Set(gridData.map(c => c.id));
  let availablePlayers = activePool.filter(p => !usedTargets.has(p.id) && !gridIds.has(p.id));

  // Only pick targets that have a valid connection to an UNCLICKED tile
  let candidatePool = availablePlayers.filter(candidate => {
      if (!dbAssociations[candidate.id]) return false;
      return unclicked.some(tile => dbAssociations[candidate.id][tile.id] === true);
  });

  if (candidatePool.length === 0) {
      handleGameComplete(false, "Deck exhausted! Not enough connections.");
      return;
  }

  const selectedTarget = candidatePool[Math.floor(rng() * candidatePool.length)];

  currentPlayer = selectedTarget;
  usedTargets.add(currentPlayer.id);
  turnsLeft--;

  targetEl.textContent = currentPlayer.name;
  turnsEl.textContent = turnsLeft;
  messageEl.textContent = `Find connection for: ${currentPlayer.name}`;
  messageEl.className = "message-area";
  messageEl.style.color = "#555";

  if (isDailyMode) timeLimit = 10;
  if (timeLimit > 0) startTimer(timeLimit);
  else {
      timerEl.textContent = "∞";
      timerEl.classList.remove("timer-warning");
  }
}

function startTimer(seconds) {
currentTime = seconds;
timerEl.textContent = `${currentTime}`;
timerEl.classList.remove("timer-warning");

timerInterval = setInterval(() => {
currentTime--;
timerEl.textContent = `${currentTime}`;

if (currentTime <= 3) timerEl.classList.add("timer-warning");

if (currentTime <= 0) {
clearInterval(timerInterval);
messageEl.textContent = isDailyMode ? "⏰ Time Up! (-500)" : "⏰ Time Up! (-1)";
messageEl.className = "message-area msg-error";
score += isDailyMode ? -500 : -1;
triggerRoast('timeout');
scoreEl.textContent = score;
AudioController.play('wrong');
if (navigator.vibrate) navigator.vibrate(200);
updateMultiplayerState();
setTimeout(pickNextTarget, 1000);
}
}, 1000);
}

function handleCellClick(cellEl, cellData) {
if (cellData.clicked || isGameOver) return;
if (timeLimit > 0 && currentTime <= 0) return;

clearInterval(timerInterval);
cellData.clicked = true;
let isMatch = dbAssociations[currentPlayer.id] && dbAssociations[currentPlayer.id][cellData.id] === true;

if (isMatch) {
cellEl.classList.add('correct');
cellData.status = 'correct';
if (isDailyMode) {
score += (1000 + (100 * currentTime));
messageEl.textContent = `Correct! (+${1000 + (100 * currentTime)})`;
} else {
score++;
messageEl.textContent = "Correct! (+1)";
}
messageEl.className = "message-area msg-success";
AudioController.play('correct');
if (navigator.vibrate) navigator.vibrate(50);
confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
checkBingoWin();
} else {
cellEl.classList.add('incorrect');
cellData.status = 'incorrect';
score += isDailyMode ? -500 : -1;
triggerRoast('wrong');
messageEl.textContent = isDailyMode ? "Wrong! (-500)" : "Wrong! (-1)";
messageEl.className = "message-area msg-error";
AudioController.play('wrong');
if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
}
scoreEl.textContent = score;
updateMultiplayerState();
setTimeout(pickNextTarget, 1000);
}

function checkBingoWin() {
const lines = [
[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
[0, 5, 10, 15], [3, 6, 9, 12]
];
let bingo = false;
lines.forEach(line => {
if (line.every(idx => gridData[idx].status === 'correct')) {
line.forEach(idx => {
const c = gridEl.children[idx];
if (!c.classList.contains('bingo-line')) { c.classList.add('bingo-line'); bingo = true; }
});
}
});
if (bingo) {
messageEl.textContent = "BINGO! LINE COMPLETE!";
messageEl.className = "message-area msg-bingo";
AudioController.play('correct');
}
}

async function handleGameComplete(isWin, failureReason = "Ran out of names!") {
isGameOver = true;
clearInterval(timerInterval);

if (gameMode === 'multi') {
const finishTime = (Date.now() - gameStartTime) / 1000;
updateMultiplayerState(true);

if (cachedOpponentData && cachedOpponentData.finished) {
const myFinalData = { score: score, finished: true, finishTime: finishTime };
if (myPlayerId === 'p1') determineWinner(myFinalData, cachedOpponentData);
else determineWinner(cachedOpponentData, myFinalData);
} else {
targetEl.textContent = "Waiting...";
document.getElementById('modalTitle').textContent = "FINISHED!";
document.getElementById('rankDisplay').textContent = "Waiting for Opponent...";
document.getElementById('modalMessage').textContent = `Your Score: ${score}`;
document.getElementById('gameModal').classList.remove('hidden');
document.getElementById('modalRestartBtn').style.display = 'none';
document.getElementById('shareBtn').style.display = 'none';
}
return;
}


if (isDailyMode) {
targetEl.textContent = isWin ? "Daily Complete!" : "Daily Over";
const modal = document.getElementById('gameModal');
const title = document.getElementById('modalTitle');
const msg = document.getElementById('modalMessage');
const rankDisplay = document.getElementById('rankDisplay');

dailyTotalTime = (Date.now() - dailyStartTime) / 1000;

try {
await db.ref('dailyBingo/' + dailyDateKey + '/leaderboard').push({
username: dailyUsername,
score: score,
time: dailyTotalTime
});
await showDailyLeaderboard();
} catch (error) {
console.error('Failed to submit/fetch daily leaderboard:', error);
dailyLeaderboardList.innerHTML = '<li>Leaderboard unavailable right now.</li>';
}

title.textContent = "DAILY BINGO";
title.style.color = "#2962ff";
msg.textContent = `Your Score: ${score} | Time: ${dailyTotalTime.toFixed(1)}s`;
rankDisplay.parentElement.classList.add('hidden');
msg.classList.add('hidden');
dailyLeaderboard.classList.remove('hidden');
document.getElementById('shareBtn').style.display = 'none';
document.getElementById('modalRestartBtn').style.display = 'inline-block';
modal.classList.remove('hidden');
return;
}

// SINGLE PLAYER
targetEl.textContent = isWin ? "Victory!" : "Defeat";
const modal = document.getElementById('gameModal');
const title = document.getElementById('modalTitle');
const msg = document.getElementById('modalMessage');
const rankDisplay = document.getElementById('rankDisplay');

rankDisplay.parentElement.classList.remove('hidden');
msg.classList.remove('hidden');
dailyLeaderboard.classList.add('hidden');

rankDisplay.textContent = getCricketRank(score);

if (isWin) {
title.textContent = "VICTORY! 🏆";
title.style.color = "#00c853";
msg.textContent = `Score: ${score}`;
AudioController.play('win');
triggerMassiveFireworks();
} else {
title.textContent = "GAME OVER";
title.style.color = "#d32f2f";
msg.textContent = `${failureReason} Score: ${score}`;
AudioController.play('lose');
}

document.getElementById('shareBtn').style.display = 'inline-block';
document.getElementById('modalRestartBtn').style.display = 'inline-block';
modal.classList.remove('hidden');
}

// Share Button
document.getElementById('shareBtn').addEventListener('click', () => {
const rank = getCricketRank(score);
const currentUrl = window.location.href;

const text = `🏏 I scored ${score}/16 in DJ's Cricket Bingo!\nRank: ${rank}\nCan you beat me? Play here: ${currentUrl}`;

if (navigator.share) {
navigator.share({ title: "DJ's Cricket Bingo", text: text, url: currentUrl }).catch(() => { });
} else {
navigator.clipboard.writeText(text);
alert("Result copied to clipboard!");
}
});

function triggerMassiveFireworks() {
const end = Date.now() + 3000;
(function frame() {
confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
if (Date.now() < end) requestAnimationFrame(frame);
}());
}

// Controls

document.getElementById('freeHitBtn').addEventListener('click', () => {
if (isGameOver || hasUsedFreeHit || isDailyMode) return;

clearInterval(timerInterval);

hasUsedFreeHit = true;
document.getElementById('freeHitBtn').disabled = true;

const unclicked = gridData.filter(cell => cell.clicked === false);
if (unclicked.length === 0) return;

const cellData = unclicked[Math.floor(Math.random() * unclicked.length)];
cellData.clicked = true;
cellData.status = 'correct';

const cellEl = gridEl.children[cellData.index];
if (cellEl) cellEl.classList.add('correct');

score += 1;
scoreEl.textContent = score;

AudioController.play('correct');
confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });

messageEl.textContent = "Free Hit Used! (+1)";
messageEl.className = "message-area msg-success";

checkBingoWin();
updateMultiplayerState();
setTimeout(pickNextTarget, 1000);
});

nextBtn.addEventListener('click', () => {
if (isGameOver) return;
if (skipsLeft > 0) {
skipsLeft--;
triggerRoast('skip');
document.getElementById('skipsCount').textContent = skipsLeft;
messageEl.textContent = "Skipped Target";
AudioController.play('pop');
pickNextTarget();
if (skipsLeft === 0) {
nextBtn.disabled = true;
nextBtn.innerHTML = "No Skips";
}
}
});

document.getElementById('quitBtn').addEventListener('click', () => {
isGameOver = true;
clearInterval(timerInterval);
if (gameMode === 'multi') { updateMultiplayerState(true); location.reload(); return; }
if (isDailyMode) {
setRuntimeGameData(basePlayers, baseDifficulty, baseAssociations);
deactivateDailyMode();
gameMode = 'single';
levelScreen.classList.remove('hidden');
gameArea.classList.add('hidden');
return;
}
location.reload();
});


document.getElementById('modalRestartBtn').addEventListener('click', async () => {
document.getElementById('gameModal').classList.add('hidden');
dailyLeaderboard.classList.add('hidden');
document.getElementById('rankDisplay').parentElement.classList.remove('hidden');
document.getElementById('modalMessage').classList.remove('hidden');
if (isDailyMode) {
await startDailyBingo();
return;
}
location.reload();
});

initGameData();






