const fs = require('fs');

const today = new Date().toISOString().split('T')[0];
console.log(`⚙️ Compiling Daily Grid for ${today}...`);

const rawData = fs.readFileSync('daily-source.json', 'utf8');
const deck = JSON.parse(rawData);

if (deck.length < 32) {
  throw new Error(`daily-source.json must include at least 32 players. Found ${deck.length}.`);
}

const dbPlayers = {};
const dbDifficulty = { easy: [], medium: [], hard: [] };
const dbAssociations = {};
const getId = (name) => "p_" + name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");


deck.forEach((p) => {
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
    const sharedTeams = p1.teams.filter((t) => p2.teams.includes(t));
    if (sharedTeams.length > 0) {
      const id1 = getId(p1.name);
      const id2 = getId(p2.name);
      dbAssociations[id1][id2] = true;
      dbAssociations[id2][id1] = true;
    }
  }
}

class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
}

function shuffle(input, rand) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function findPerfectMatching(targetIds, gridIds) {
  const matchGridToTarget = {};

  function dfs(targetId, seen) {
    for (const gridId of gridIds) {
      if (!dbAssociations[targetId] || dbAssociations[targetId][gridId] !== true || seen.has(gridId)) {
        continue;
      }

      seen.add(gridId);
      if (!matchGridToTarget[gridId] || dfs(matchGridToTarget[gridId], seen)) {
        matchGridToTarget[gridId] = targetId;
        return true;
      }
    }
    return false;
  }

  let matched = 0;
  for (const targetId of targetIds) {
    if (dfs(targetId, new Set())) matched++;
  }

  if (matched !== gridIds.length) return null;

  const targetToGrid = {};
  for (const gridId of gridIds) {
    const targetId = matchGridToTarget[gridId];
    if (!targetId) return null;
    targetToGrid[targetId] = gridId;
  }

  return targetToGrid;
}

function buildDailyDeck() {
  const allIds = Object.keys(dbPlayers);
  const dateSeed = Number(today.replace(/-/g, ''));
  const rng = new SeededRandom(dateSeed);

  for (let attempt = 1; attempt <= 1000; attempt++) {
    const shuffled = shuffle(allIds, () => rng.next());
    const gridIds = shuffled.slice(0, 16);
    const remaining = shuffled.slice(16);

    const eligibleTargets = remaining.filter((targetId) =>
      gridIds.some((gridId) => dbAssociations[targetId] && dbAssociations[targetId][gridId] === true)
    );

    if (eligibleTargets.length < 16) continue;

    const targetIds = eligibleTargets.slice(0, 16);
    const targetToGrid = findPerfectMatching(targetIds, gridIds);

    if (!targetToGrid) continue;

    const orderedTargets = shuffle(targetIds, () => rng.next());

    console.log(`✅ Found solvable daily deck in ${attempt} attempt(s).`);
    return {
      dailyGrid: gridIds,
      dailyTargets: orderedTargets,
      targetToGrid,
    };
  }

  throw new Error('Unable to generate a solvable daily deck with a perfect 16x16 matching.');
}

const solvableDeck = buildDailyDeck();

if (!Array.isArray(solvableDeck.dailyGrid) || solvableDeck.dailyGrid.length !== 16) {
  throw new Error('Compiler error: dailyGrid must contain exactly 16 player IDs.');
}

if (!Array.isArray(solvableDeck.dailyTargets) || solvableDeck.dailyTargets.length !== 16) {
  throw new Error('Compiler error: dailyTargets must contain exactly 16 player IDs.');
}

const finalJSON = {
  dailyBingo: {
    [today]: {
      deck: {
        players: dbPlayers,
        difficulty: dbDifficulty,
        associations: { merged: dbAssociations },
        dailyGrid: solvableDeck.dailyGrid,
        dailyTargets: solvableDeck.dailyTargets,
      },
    },
  },
};

fs.writeFileSync('daily-ready.json', JSON.stringify(finalJSON, null, 2));
console.log('✅ SUCCESS! Saved to daily-ready.json.');
