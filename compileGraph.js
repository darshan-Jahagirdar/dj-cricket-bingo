const fs = require('fs');

console.log("⚙️ Starting Graph Compilation...");

// 1. Read the human-readable master deck
const rawData = fs.readFileSync('master-deck.json', 'utf8');
const deck = JSON.parse(rawData);

const dbPlayers = {};
const dbDifficulty = { easy: [], medium: [], hard: [] };
const dbAssociations = {};

// Helper to make clean IDs
const getId = (name) => "p_" + name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

// 2. Build the Nodes
deck.forEach(p => {
    const pId = getId(p.name);
    dbPlayers[pId] = { name: p.name, difficulty: p.difficulty };
    
    if (!dbDifficulty[p.difficulty]) dbDifficulty[p.difficulty] = [];
    dbDifficulty[p.difficulty].push(pId);
    
    dbAssociations[pId] = {};
});

// 3. Build the Edges (Two-Way Connections)
for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
        const p1 = deck[i];
        const p2 = deck[j];
        
        // Check for shared teams
        const sharedTeams = p1.teams.filter(t => p2.teams.includes(t));
        
        if (sharedTeams.length > 0) {
            const id1 = getId(p1.name);
            const id2 = getId(p2.name);
            dbAssociations[id1][id2] = true;
            dbAssociations[id2][id1] = true;
        }
    }
}

// 4. Format for Firebase
const finalJSON = {
    players: dbPlayers,
    difficulty: dbDifficulty,
    associations: { merged: dbAssociations }
};

// 5. Save the output
fs.writeFileSync('firebase-ready.json', JSON.stringify(finalJSON, null, 2));

console.log(`✅ SUCCESS! Compiled ${deck.length} players.`);
console.log("📁 Output saved to 'firebase-ready.json'. Ready for Firebase import!");