const fs = require('fs');

const today = new Date().toISOString().split('T')[0];
console.log(`⚙️ Compiling Daily Grid for ${today}...`);

const rawData = fs.readFileSync('daily-source.json', 'utf8');
let deck = JSON.parse(rawData);

if (deck.length < 32) {
    console.error(`❌ ERROR: You need at least 32 players in daily-source.json to build a 16x16 game!`);
    process.exit(1);
}

const dbPlayers = {};
const dbDifficulty = { easy: [], medium: [], hard: [] };
const dbAssociations = {};
const getId = (name) => "p_" + name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

// 1. Build Nodes
deck.forEach(p => {
    const pId = getId(p.name);
    dbPlayers[pId] = { name: p.name, difficulty: p.difficulty };
    
    if (!dbDifficulty[p.difficulty]) dbDifficulty[p.difficulty] = [];
    dbDifficulty[p.difficulty].push(pId);
    dbAssociations[pId] = {};
});

// 2. Build Connections
for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
        const p1 = deck[i];
        const p2 = deck[j];
        const sharedTeams = p1.teams.filter(t => p2.teams.includes(t));
        if (sharedTeams.length > 0) {
            const id1 = getId(p1.name);
            const id2 = getId(p2.name);
            dbAssociations[id1][id2] = true;
            dbAssociations[id2][id1] = true;
        }
    }
}

// --- 3. SMART ENGINE: Guaranteed Solvability ---
let allIds = Object.keys(dbPlayers);
allIds.sort(() => Math.random() - 0.5); // Shuffle

let dailyGrid = allIds.slice(0, 16); // Reserve 16 for the board
let remainingIds = allIds.slice(16);
let dailyTargets = [];

// Find 16 targets that have AT LEAST one valid connection on the board
for (let id of remainingIds) {
    let hasConnection = dailyGrid.some(gridId => dbAssociations[id] && dbAssociations[id][gridId]);
    if (hasConnection) {
        dailyTargets.push(id);
    }
    if (dailyTargets.length === 16) break;
}

if (dailyTargets.length < 16) {
    console.error("❌ ERROR: Could not find 16 valid targets! Add more overlapping players to daily-source.json.");
    process.exit(1);
}

// 4. Export
const finalJSON = {
    "dailyBingo": {
        [today]: {
            "deck": {
                "players": dbPlayers,
                "difficulty": dbDifficulty,
                "associations": { "merged": dbAssociations },
                "dailyGrid": dailyGrid,        // <-- ADDED
                "dailyTargets": dailyTargets   // <-- ADDED
            }
        }
    }
};

fs.writeFileSync('daily-ready.json', JSON.stringify(finalJSON, null, 2));
console.log(`✅ SUCCESS! Saved mathematically solvable board to daily-ready.json.`);