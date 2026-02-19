import { wordCategories, categoryNames } from './words.js';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Creates a new game round with:
 * - One random word from a random category (avoids repeating last 2 categories/words)
 * - Imposter(s): ~90% 1 imposter, ~5% no imposter, ~5% 2 imposters
 * - Turn order assigned to each player (1st, 2nd, 3rd...)
 */
export function createRound(playerIds, recentRounds = []) {
  const lastTwo = recentRounds.slice(-2);
  const skipCategories = lastTwo.map((r) => r?.category).filter(Boolean);
  const skipWords = lastTwo.map((r) => ({ cat: r?.category, word: r?.word })).filter((x) => x.cat && x.word);

  const availableCategories = categoryNames.filter((c) => !skipCategories.includes(c));
  const category = availableCategories.length > 0
    ? availableCategories[randomInt(0, availableCategories.length)]
    : categoryNames[randomInt(0, categoryNames.length)];

  let words = [...wordCategories[category]];
  const excludeWords = skipWords.filter((x) => x.cat === category).map((x) => x.word);
  if (excludeWords.length > 0) {
    words = words.filter((w) => !excludeWords.includes(w));
  }
  if (words.length === 0) words = [...wordCategories[category]];
  const word = words[randomInt(0, words.length)];

  // ~10% chance: no imposter OR 2 imposters (mutually exclusive, 50/50 split within that 10%)
  // Prefer players who've been imposter fewer times in last ~10 rounds (soft cap, repeats allowed)
  const lastTen = recentRounds.slice(-10);
  const imposterCount = {};
  playerIds.forEach((id) => { imposterCount[id] = 0; });
  lastTen.forEach((r) => (r?.imposterIds || []).forEach((id) => { imposterCount[id] = (imposterCount[id] || 0) + 1; }));

  const specialRoll = Math.random();
  let imposterIds = [];
  let roundVariant = 'normal';

  if (specialRoll < 0.05) {
    roundVariant = 'no_imposter';
  } else if (specialRoll < 0.1) {
    roundVariant = 'two_imposters';
    const pool = pickByLowestCount(playerIds, imposterCount, 2);
    const [i, j] = pickTwoDifferent(pool.length);
    imposterIds = [pool[i], pool[j]];
  } else {
    const pool = pickByLowestCount(playerIds, imposterCount, 1);
    imposterIds = [pool[randomInt(0, pool.length)]];
  }

  // ~10% chance imposter goes first (only if we have exactly 1 imposter)
  let turnOrder;
  if (roundVariant === 'normal' && Math.random() < 0.1) {
    const imposterId = imposterIds[0];
    const others = playerIds.filter((id) => id !== imposterId);
    turnOrder = [imposterId, ...others.sort(() => Math.random() - 0.5)];
  } else {
    turnOrder = [...playerIds].sort(() => Math.random() - 0.5);
  }

  const assignments = {};
  turnOrder.forEach((playerId, index) => {
    const position = index + 1;
    const positionText = getOrdinal(position);
    const isImposter = imposterIds.includes(playerId);

    assignments[playerId] = {
      word: isImposter ? null : word,
      category: isImposter ? category : null,
      isImposter,
      roundVariant,
      turnOrder: position,
      turnOrderText: `You're ${positionText}`,
    };
  });

  return {
    category,
    word,
    imposterIds,
    roundVariant,
    assignments,
    turnOrder,
  };
}

function pickTwoDifferent(n) {
  const i = randomInt(0, n);
  let j = randomInt(0, n - 1);
  if (j >= i) j++;
  return [i, j];
}

/** Returns players to pick from, preferring those with lowest imposter count in recent rounds. */
function pickByLowestCount(playerIds, imposterCount, need) {
  const byCount = playerIds.slice().sort((a, b) => (imposterCount[a] || 0) - (imposterCount[b] || 0));
  const minCount = imposterCount[byCount[0]] ?? 0;
  const lowCount = byCount.filter((id) => (imposterCount[id] ?? 0) <= minCount);
  return lowCount.length >= need ? lowCount : playerIds;
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Creates a custom round: host picks category + word, host does NOT play.
 * playerIds = only playing players (excludes host). Imposter is random among them.
 */
export function createRoundCustom(category, word, playerIds, recentRounds = []) {
  if (!playerIds.length) throw new Error('Need at least one player');
  const lastTen = recentRounds.slice(-10);
  const imposterCount = {};
  playerIds.forEach((id) => { imposterCount[id] = 0; });
  lastTen.forEach((r) => (r?.imposterIds || []).forEach((id) => { imposterCount[id] = (imposterCount[id] || 0) + 1; }));

  const specialRoll = Math.random();
  let imposterIds = [];
  let roundVariant = 'normal';
  if (specialRoll < 0.05) {
    roundVariant = 'no_imposter';
  } else if (specialRoll < 0.1 && playerIds.length >= 2) {
    roundVariant = 'two_imposters';
    const pool = pickByLowestCount(playerIds, imposterCount, 2);
    const [i, j] = pickTwoDifferent(pool.length);
    imposterIds = [pool[i], pool[j]];
  } else {
    const pool = pickByLowestCount(playerIds, imposterCount, 1);
    imposterIds = [pool[randomInt(0, pool.length)]];
  }

  let turnOrder = [...playerIds].sort(() => Math.random() - 0.5);
  if (roundVariant === 'normal' && Math.random() < 0.1 && imposterIds.length === 1) {
    const imposterId = imposterIds[0];
    const others = playerIds.filter((id) => id !== imposterId);
    turnOrder = [imposterId, ...others.sort(() => Math.random() - 0.5)];
  }

  const assignments = {};
  turnOrder.forEach((playerId, index) => {
    const position = index + 1;
    const positionText = getOrdinal(position);
    const isImposter = imposterIds.includes(playerId);
    assignments[playerId] = {
      word: isImposter ? null : word,
      category: isImposter ? category : null,
      isImposter,
      roundVariant,
      turnOrder: position,
      turnOrderText: `You're ${positionText}`,
    };
  });

  return {
    category,
    word,
    imposterIds,
    roundVariant,
    assignments,
    turnOrder,
  };
}
