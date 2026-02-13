import { wordCategories, categoryNames } from './words.js';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Creates a new game round with:
 * - One random word from a random category
 * - Imposter(s): ~90% 1 imposter, ~5% no imposter, ~5% 2 imposters
 * - Turn order assigned to each player (1st, 2nd, 3rd...)
 */
export function createRound(playerIds) {
  const category = categoryNames[randomInt(0, categoryNames.length)];
  const words = wordCategories[category];
  const word = words[randomInt(0, words.length)];

  // ~10% chance: no imposter OR 2 imposters (mutually exclusive, 50/50 split within that 10%)
  const specialRoll = Math.random();
  let imposterIds = [];
  let roundVariant = 'normal';

  if (specialRoll < 0.05) {
    roundVariant = 'no_imposter';
  } else if (specialRoll < 0.1) {
    roundVariant = 'two_imposters';
    const [i, j] = pickTwoDifferent(playerIds.length);
    imposterIds = [playerIds[i], playerIds[j]];
  } else {
    imposterIds = [playerIds[randomInt(0, playerIds.length)]];
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

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
