const fs = require('fs');

const today = new Date().toISOString().split('T')[0];
console.log(`⚙️ Compiling Daily Grid for ${today}...`);

const rawData = fs.readFileSync('daily-source.json', 'utf8');
let deck = JSON.parse(rawData);

// REMOVED the strict 16 player limit! Added a warning instead.
if (deck.length < 32) {
    console.warn(`⚠️ WARNING: You only have ${deck.length} players. To have a 16-tile grid AND 16 unique targets, you should have at least 32 players in daily-source.json!`);
}

const dbPlayers = {};
const dbDifficulty = { easy: [], medium: [], hard: [] };
const dbAssociations = {};
const getId = (name) => "p_" + name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

deck.forEach(p => {
    const pId = getId(p.name);
    dbPlayers[pId] = { name: p.name, difficulty: p.difficulty };
    
    if (!dbDifficulty[p.difficulty]) dbDifficulty[p.difficulty] = [];
    dbDifficulty[p.difficulty].push(pId);

    dbAssociations[pId] = {};
});

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

const finalJSON = {
    "dailyBingo": {
        [today]: {
            "deck": {
                "players": dbPlayers,
                "difficulty": dbDifficulty,
                "associations": { "merged": dbAssociations }
            }
        }
    }
};

fs.writeFileSync('daily-ready.json', JSON.stringify(finalJSON, null, 2));
console.log(`✅ SUCCESS! Saved to daily-ready.json.`);