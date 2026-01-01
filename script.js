// =================================================
// 0. SETUP: FIREBASE & AUDIO
// =================================================
const USE_ASSOCIATIONS = true;


// ✅ YOUR FIREBASE CONFIG
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

const playerNameToId = {
"Virat Kohli": "p_virat_kohli",
"Rohit Sharma": "p_rohit_sharma",
"MS Dhoni": "p_ms_dhoni",
"AB de Villiers": "p_ab_de_villiers",
"Faf du Plessis": "p_faf_du_plessis",
"Rishabh Pant": "p_rishabh_pant",
"Jasprit Bumrah": "p_jasprit_bumrah",
"Hardik Pandya": "p_hardik_pandya",
"Glenn Maxwell": "p_glenn_maxwell",
"David Warner": "p_david_warner",
"Kane Williamson": "p_kane_williamson",
"Steve Smith": "p_steve_smith",
"Chris Lynn": "p_chris_lynn",
"Marcus Stoinis": "p_marcus_stoinis",
"Aaron Finch": "p_aaron_finch"
};

let playersById = {};

function loadPlayers() {
return db.ref('players').once('value').then(snapshot => {
playersById = snapshot.val() || {};
console.log("Players loaded:", playersById);
});
}


let difficultyPools = {
easy: [],
medium: [],
hard: []
};


function loadDifficultyPools() {
return db.ref('difficulty').once('value').then(snapshot => {
const data = snapshot.val();
if (!data) throw new Error("Difficulty data missing");

difficultyPools.easy = data.easy || [];
difficultyPools.medium = data.medium || [];
difficultyPools.hard = data.hard || [];

console.log("Difficulty pools loaded:", difficultyPools);
});
}



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
// 1. DATASETS
// =================================================
const Teams = {
IND: "India", AUS: "Australia", ENG: "England", WI: "West Indies", NZ: "New Zealand", SA: "South Africa", PAK: "Pakistan", SL: "Sri Lanka", AFG: "Afghanistan", BAN: "Bangladesh",
RCB: "RCB", MI: "MI", CSK: "CSK", KKR: "KKR", SRH: "SRH", RR: "RR",
DC: "DC (Delhi Capitals)", DD: "DD (Daredevils)", KXIP: "KXIP/PBKS", GT: "GT", LSG: "LSG",
ST: "Sydney Thunder", SS: "Sydney Sixers", MS: "Melbourne Stars", MR: "Melbourne Renegades",
BH: "Brisbane Heat", HH: "Hobart Hurricanes", AS: "Adelaide Strikers", PS: "Perth Scorchers",
DEC: "Deccan Chargers", PWI: "Pune Warriors", GL: "Gujarat Lions", RPS: "Rising Pune Supergiant"
};

const easyPlayers = [
{ name: "Virat Kohli", teams: [Teams.IND, Teams.RCB] },
{ name: "Rohit Sharma", teams: [Teams.IND, Teams.MI, Teams.DEC] },
{ name: "MS Dhoni", teams: [Teams.IND, Teams.CSK, Teams.RPS] },
{ name: "David Warner", teams: [Teams.AUS, Teams.SRH, Teams.DC, Teams.DD, Teams.ST] },
{ name: "Hardik Pandya", teams: [Teams.IND, Teams.MI, Teams.GT] },
{ name: "Jasprit Bumrah", teams: [Teams.IND, Teams.MI] },
{ name: "Glenn Maxwell", teams: [Teams.AUS, Teams.RCB, Teams.KXIP, Teams.MI, Teams.DD, Teams.MS] },
{ name: "Pat Cummins", teams: [Teams.AUS, Teams.KKR, Teams.SRH, Teams.DD] },
{ name: "Rashid Khan", teams: [Teams.AFG, Teams.SRH, Teams.GT, Teams.AS] },
{ name: "Jos Buttler", teams: [Teams.ENG, Teams.RR, Teams.MI, Teams.ST] },
{ name: "Ben Stokes", teams: [Teams.ENG, Teams.CSK, Teams.RR, Teams.RPS, Teams.MR] },
{ name: "Ravindra Jadeja", teams: [Teams.IND, Teams.CSK, Teams.RR, Teams.GT, Teams.GL] },
{ name: "KL Rahul", teams: [Teams.IND, Teams.RCB, Teams.SRH, Teams.KXIP, Teams.LSG] },
{ name: "Andre Russell", teams: [Teams.WI, Teams.KKR, Teams.DD, Teams.MR] },
{ name: "Sunil Narine", teams: [Teams.WI, Teams.KKR, Teams.SS] },
{ name: "Steve Smith", teams: [Teams.AUS, Teams.RR, Teams.RPS, Teams.PWI, Teams.DC, Teams.SS] },
{ name: "Trent Boult", teams: [Teams.NZ, Teams.SRH, Teams.MI, Teams.RR, Teams.KKR, Teams.DD, Teams.MS] },
{ name: "Rishabh Pant", teams: [Teams.IND, Teams.DC, Teams.DD] },
{ name: "Shubman Gill", teams: [Teams.IND, Teams.KKR, Teams.GT] },
{ name: "Faf du Plessis", teams: [Teams.SA, Teams.CSK, Teams.RCB, Teams.RPS, Teams.MR] },
{ name: "Suryakumar Yadav", teams: [Teams.IND, Teams.MI, Teams.KKR] },
{ name: "Jofra Archer", teams: [Teams.ENG, Teams.RR, Teams.MI, Teams.HH] },
{ name: "Sam Curran", teams: [Teams.ENG, Teams.CSK, Teams.KXIP] },
{ name: "Moeen Ali", teams: [Teams.ENG, Teams.CSK, Teams.RCB] },
{ name: "Kagiso Rabada", teams: [Teams.SA, Teams.DC, Teams.KXIP] },
{ name: "Quinton de Kock", teams: [Teams.SA, Teams.MI, Teams.LSG, Teams.RCB, Teams.SRH, Teams.DD] },
{ name: "Shreyas Iyer", teams: [Teams.IND, Teams.DC, Teams.KKR] },
{ name: "Sanju Samson", teams: [Teams.IND, Teams.RR, Teams.DD] },
{ name: "Yuzvendra Chahal", teams: [Teams.IND, Teams.RCB, Teams.RR, Teams.MI] },
{ name: "Bhuvneshwar Kumar", teams: [Teams.IND, Teams.SRH, Teams.PWI, Teams.RCB] }
];

const mediumPlayers = [
{ name: "AB de Villiers", teams: [Teams.SA, Teams.RCB, Teams.DD, Teams.BH] },
{ name: "Yuvraj Singh", teams: [Teams.IND, Teams.KXIP, Teams.PWI, Teams.RCB, Teams.SRH, Teams.MI] },
{ name: "Chris Gayle", teams: [Teams.WI, Teams.KKR, Teams.RCB, Teams.KXIP, Teams.MR] },
{ name: "Dwayne Bravo", teams: [Teams.WI, Teams.CSK, Teams.MI, Teams.GL, Teams.MR, Teams.MS] },
{ name: "Kieron Pollard", teams: [Teams.WI, Teams.MI, Teams.AS, Teams.MR] },
{ name: "Shane Warne", teams: [Teams.AUS, Teams.RR, Teams.MS] },
{ name: "Adam Gilchrist", teams: [Teams.AUS, Teams.DEC, Teams.KXIP] },
{ name: "Brendon McCullum", teams: [Teams.NZ, Teams.KKR, Teams.CSK, Teams.RCB, Teams.GL, "KTK", Teams.BH] },
{ name: "Gautam Gambhir", teams: [Teams.IND, Teams.DD, Teams.KKR] },
{ name: "Zaheer Khan", teams: [Teams.IND, Teams.MI, Teams.RCB, Teams.DD] },
{ name: "Suresh Raina", teams: [Teams.IND, Teams.CSK, Teams.GL] },
{ name: "Harbhajan Singh", teams: [Teams.IND, Teams.MI, Teams.CSK, Teams.KKR] },
{ name: "Shakib Al Hasan", teams: [Teams.BAN, Teams.KKR, Teams.SRH, Teams.MR] },
{ name: "Kane Williamson", teams: [Teams.NZ, Teams.SRH, Teams.GT] },
{ name: "Lasith Malinga", teams: [Teams.SL, Teams.MI, Teams.MS] },
{ name: "Muthiah Muralidaran", teams: [Teams.SL, Teams.CSK, Teams.RCB, "KTK", Teams.MR] },
{ name: "Virender Sehwag", teams: [Teams.IND, Teams.DD, Teams.KXIP] },
{ name: "Dale Steyn", teams: [Teams.SA, Teams.RCB, Teams.SRH, Teams.DEC, Teams.GL] },
{ name: "Mitchell Johnson", teams: [Teams.AUS, Teams.MI, Teams.KXIP, Teams.KKR, Teams.PS] },
{ name: "Brett Lee", teams: [Teams.AUS, Teams.KXIP, Teams.KKR, Teams.SS] },
{ name: "Michael Hussey", teams: [Teams.AUS, Teams.CSK, Teams.MI, Teams.PS, Teams.ST] },
{ name: "Sourav Ganguly", teams: [Teams.IND, Teams.KKR, Teams.PWI] },
{ name: "Rahul Dravid", teams: [Teams.IND, Teams.RCB, Teams.RR] },
{ name: "Sachin Tendulkar", teams: [Teams.IND, Teams.MI] },
{ name: "Jacques Kallis", teams: [Teams.SA, Teams.RCB, Teams.KKR, Teams.ST] },
{ name: "Graeme Smith", teams: [Teams.SA, Teams.RR, Teams.PWI] },
{ name: "Kumar Sangakkara", teams: [Teams.SL, Teams.KXIP, Teams.DEC, Teams.SRH] },
{ name: "Mahela Jayawardene", teams: [Teams.SL, Teams.KXIP, "KTK", Teams.DD] },
{ name: "Shoaib Akhtar", teams: [Teams.PAK, Teams.KKR] },
{ name: "Shahid Afridi", teams: [Teams.PAK, Teams.DEC] }
];

const hardPlayers = [
{ name: "Chris Lynn", teams: [Teams.AUS, Teams.KKR, Teams.MI, Teams.DEC, Teams.BH, Teams.AS] },
{ name: "Marcus Stoinis", teams: [Teams.AUS, Teams.KXIP, Teams.RCB, Teams.DC, Teams.LSG, Teams.MS] },
{ name: "Aaron Finch", teams: [Teams.AUS, Teams.RR, Teams.DD, Teams.PWI, Teams.SRH, Teams.MI, Teams.GL, Teams.KXIP, Teams.RCB, Teams.MR] },
{ name: "Dan Christian", teams: [Teams.AUS, Teams.DEC, Teams.RCB, Teams.RPS, Teams.DC, Teams.BH, Teams.HH, Teams.SS] },
{ name: "Moises Henriques", teams: [Teams.AUS, Teams.KKR, Teams.DD, Teams.RCB, Teams.SRH, Teams.KXIP, Teams.SS] },
{ name: "Ben Cutting", teams: [Teams.AUS, Teams.RR, Teams.SRH, Teams.MI, Teams.KKR, Teams.BH, Teams.ST] },
{ name: "Tim David", teams: ["Singapore", Teams.AUS, Teams.RCB, Teams.MI, Teams.HH] },
{ name: "Shaun Marsh", teams: [Teams.AUS, Teams.KXIP, Teams.PS, Teams.MR] },
{ name: "Brad Hodge", teams: [Teams.AUS, Teams.KKR, "KTK", Teams.RR, Teams.MS, Teams.AS, Teams.MR] },
{ name: "Matthew Wade", teams: [Teams.AUS, Teams.DD, Teams.GT, Teams.HH] },
{ name: "James Faulkner", teams: [Teams.AUS, Teams.PWI, Teams.KXIP, Teams.RR, Teams.GL, Teams.MS, Teams.HH] },
{ name: "Sandeep Lamichhane", teams: ["Nepal", Teams.DD, Teams.DC, Teams.MS, Teams.HH] },
{ name: "Owais Shah", teams: [Teams.ENG, Teams.KKR, Teams.RR, "KTK", Teams.HH] },
{ name: "Herschelle Gibbs", teams: [Teams.SA, Teams.DEC, Teams.MI, Teams.PS] },
{ name: "Dirk Nannes", teams: [Teams.AUS, "Netherlands", Teams.DD, Teams.RCB, Teams.CSK] },
{ name: "Azhar Mahmood", teams: [Teams.PAK, Teams.KXIP, Teams.KKR] },
{ name: "Thisara Perera", teams: [Teams.SL, Teams.CSK, "KTK", Teams.MI, Teams.SRH, Teams.KXIP, Teams.RPS] },
{ name: "Angelo Mathews", teams: [Teams.SL, Teams.KKR, Teams.PWI, Teams.DD] },
{ name: "Johan Botha", teams: [Teams.SA, Teams.RR, Teams.DD, Teams.KKR, Teams.AS, Teams.SS] },
{ name: "Albie Morkel", teams: [Teams.SA, Teams.CSK, Teams.RCB, Teams.DD, Teams.RPS] },
{ name: "Morne Morkel", teams: [Teams.SA, Teams.RR, Teams.DD, Teams.KKR] },
{ name: "Ross Taylor", teams: [Teams.NZ, Teams.RCB, Teams.RR, Teams.DD, Teams.PWI] },
{ name: "Luke Wright", teams: [Teams.ENG, Teams.PWI, Teams.MS] },
{ name: "Kevin Pietersen", teams: [Teams.ENG, Teams.RCB, Teams.DEC, Teams.DD, Teams.RPS, Teams.MS] },
{ name: "Eoin Morgan", teams: [Teams.ENG, Teams.RCB, Teams.KKR, Teams.SRH, Teams.KXIP, Teams.ST] },
{ name: "Mitchell Marsh", teams: [Teams.AUS, Teams.DEC, Teams.PWI, Teams.RPS, Teams.SRH, Teams.DC, Teams.PS] },
{ name: "Usman Khawaja", teams: [Teams.AUS, Teams.RPS, Teams.ST, Teams.BH] },
{ name: "Nathan Coulter-Nile", teams: [Teams.AUS, Teams.MI, Teams.DD, Teams.KKR, Teams.RCB, Teams.RR, Teams.PS, Teams.MS] },
{ name: "Jason Holder", teams: [Teams.WI, Teams.CSK, Teams.KKR, Teams.SRH, Teams.RR, Teams.LSG] },
{ name: "Darren Sammy", teams: [Teams.WI, Teams.SRH, Teams.RCB, Teams.KXIP, Teams.HH] }
];

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

// =================================================
// 3. UI LISTENERS
// =================================================

// Single Player Buttons -> Open Rules
document.querySelectorAll('.level-btn').forEach(btn => {
btn.addEventListener('click', () => {
gameMode = 'single';
rng = Math.random; // Reset RNG
pendingLevel = btn.dataset.level;
rulesModal.classList.remove('hidden');
AudioController.play('pop');
});
});

// Multiplayer Button -> Open Rules
document.getElementById('multiplayerBtn').addEventListener('click', () => {
gameMode = 'multi';
rulesModal.classList.remove('hidden');
AudioController.play('pop');
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

// =================================================
// 5. GAME LOGIC (Fixed & Robust)
// =================================================

function makePlayerFromId(playerId) {
return {
id: playerId,
name: playersById[playerId]?.name || "Unknown"
};
}



function startGame(level) {
score = 0;
skipsLeft = 5;
turnsLeft = 21;
isGameOver = false;
usedTargets.clear();
gameStartTime = Date.now();
cachedOpponentData = null;

scoreEl.textContent = score;
turnsEl.textContent = turnsLeft;
skipsSpan.textContent = skipsLeft;
nextBtn.disabled = false;
nextBtn.innerHTML = `Skip (<span id="skipsCount">${skipsLeft}</span>)`;
clearInterval(timerInterval);

// Populate Pool
let selectedIds = [];

if (level === 'easy') {
selectedIds = [
...difficultyPools.easy,
...difficultyPools.medium.slice(0, 5)
];
} else if (level === 'medium') {
selectedIds = [
...difficultyPools.medium,
...difficultyPools.easy.slice(0, 5)
];
} else if (level === 'hard') {
selectedIds = [
...difficultyPools.hard,
...difficultyPools.medium.slice(0, 5)
];
}


// Shuffle using current RNG (Math.random OR Seeded)
activePool = shuffle(
selectedIds.map(makePlayerFromId)
);


// Ensure UI Switch
levelScreen.classList.add('hidden');
gameArea.classList.remove('hidden');
document.getElementById('gameModal').classList.add('hidden');
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
const usedContent = new Set();
const availableTeams = [...new Set(activePool.flatMap(p => p.teams))];

let attempts = 0;
// Ensure we create exactly 16 tiles
while (gridData.length < 16 && attempts < 5000) {
attempts++;
const isPlayer = rng() > 0.45;
let content, type;

if (isPlayer) {
const p = activePool[Math.floor(rng() * activePool.length)];
content = p.id;
type = 'player';

} else {
content = availableTeams[Math.floor(rng() * availableTeams.length)];
type = 'team';
}

if (usedContent.has(content)) continue;
usedContent.add(content);

const cellData = { id: gridData.length, content, type, clicked: false, status: null };
gridData.push(cellData);

const cell = document.createElement('div');
cell.classList.add('grid-cell');
if (type === 'team') cell.classList.add('team-cell');
cell.textContent =
cellData.type === 'player'
? playersById[cellData.content].name
: cellData.content;
cell.addEventListener('click', () => handleCellClick(cell, cellData));
gridEl.appendChild(cell);
}
}

function pickNextTarget() {
clearInterval(timerInterval);
if (isGameOver) return;

const unclicked = gridData.filter(c => !c.clicked);
if (unclicked.length === 0) {
handleGameComplete(true);
return;
}
if (turnsLeft <= 0) {
handleGameComplete(false, "Ran out of turns!");
return;
}

// ROBUST SELECTION
const availablePlayers = activePool.filter(p => !usedTargets.has(p.name));
let validCandidates;

if (USE_ASSOCIATIONS) {
// TEMP: allow any unused player as target
validCandidates = availablePlayers.filter(
p => unclicked.some(tile => tile.content !== p.name)
);
} else {
// OLD LOGIC (unchanged)
validCandidates = availablePlayers.filter(player => {
return unclicked.some(tile => {
  let matches = false;
  if (tile.type === 'team') {
    matches = player.teams.includes(tile.content);
  } else {
    const tilePlayerObj = activePool.find(p => p.name === tile.content);
    if (tilePlayerObj)
      matches = player.teams.some(t => tilePlayerObj.teams.includes(t));
  }
  return matches && player.name !== tile.content;
});
});
}


if (validCandidates.length === 0) {
handleGameComplete(false, "Deck exhausted!");
return;
}

const selectedTarget = validCandidates[Math.floor(rng() * validCandidates.length)];

currentPlayer = selectedTarget;
usedTargets.add(currentPlayer.name);
turnsLeft--;


targetEl.textContent = playersById[currentPlayer.id].name;

turnsEl.textContent = turnsLeft;
messageEl.textContent = `Find connection for: ${currentPlayer.name}`;
messageEl.className = "message-area";
messageEl.style.color = "#555";

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
messageEl.textContent = "⏰ Time Up! (-1)";
messageEl.className = "message-area msg-error";
score--;
scoreEl.textContent = score;
AudioController.play('wrong');
if (navigator.vibrate) navigator.vibrate(200);
updateMultiplayerState();
setTimeout(pickNextTarget, 1000);
}
}, 1000);
}

const snap = await db
  .ref(`associations/merged/${currentPlayer.id}/${cellData.content}`)
  .once('value');

isMatch = snap.exists();




async function handleCellClick(cellEl, cellData) {

if (cellData.clicked || isGameOver) return;
if (timeLimit > 0 && currentTime <= 0) return;

clearInterval(timerInterval);
cellData.clicked = true;
let isMatch = false;

if (cellData.type === 'team') {
if (currentPlayer.teams.includes(cellData.content)) isMatch = true;
} else {
const clickedObj = activePool.find(p => p.name === cellData.content);
if (clickedObj) {
// Player–Player validation
const associationResult = await areAssociated(
currentPlayer.name,
clickedObj.name
);

if (associationResult !== null) {
isMatch = associationResult;
} else {
// Fallback to old logic
const shared = currentPlayer.teams.filter(t =>
clickedObj.teams.includes(t)
);
if (shared.length > 0 || clickedObj.name === currentPlayer.name) {
isMatch = true;
}
}

}
}

if (isMatch) {
cellEl.classList.add('correct');
cellData.status = 'correct';
score++;
messageEl.textContent = "Correct! (+1)";
messageEl.className = "message-area msg-success";
AudioController.play('correct');
if (navigator.vibrate) navigator.vibrate(50);
confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
checkBingoWin();
} else {
cellEl.classList.add('incorrect');
cellData.status = 'incorrect';
score--;
messageEl.textContent = "Wrong! (-1)";
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

function handleGameComplete(isWin, failureReason = "Ran out of names!") {
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

// SINGLE PLAYER
targetEl.textContent = isWin ? "Victory!" : "Defeat";
const modal = document.getElementById('gameModal');
const title = document.getElementById('modalTitle');
const msg = document.getElementById('modalMessage');
const rankDisplay = document.getElementById('rankDisplay');

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
nextBtn.addEventListener('click', () => {
if (isGameOver) return;
if (skipsLeft > 0) {
skipsLeft--;
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
location.reload();
});


document.getElementById('modalRestartBtn').addEventListener('click', () => location.reload());

loadDifficultyPools().catch(err => {
console.error("Failed to load difficulty pools", err);
});

Promise.all([
loadDifficultyPools(),
loadPlayers()
]).catch(console.error);







