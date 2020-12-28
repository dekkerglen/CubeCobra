import similarity from 'compute-cosine-similarity';
import { cardColorIdentity, producedMana, cardColors, cardCmc } from 'utils/Card';

const COLOR_PENALTY = [1, 1, 0.85, 0.6, 0.3, 0.1, 0];

const synergyCache = {};

const arrayMin = (arr) => {
  return arr.reduce((p, v) => {
    return p < v ? p : v;
  });
};

const arrayMax = (arr) => {
  return arr.reduce((p, v) => {
    return p > v ? p : v;
  });
};

const arrayDifference = (arrA, arrB) =>
  arrA.filter((x) => !arrB.includes(x)).concat(arrB.filter((x) => !arrA.includes(x)));

const arrayIntersection = (arrA, arrB) => arrA.filter((x) => arrB.includes(x));

const cardNameKeys = (a, b) => {
  return [a + b, b + a];
};

export const calculateSynergy = (card1, card2) => {
  if (
    !card1.details.embedding ||
    !card2.details.embedding ||
    card1.details.embedding.length === 0 ||
    card2.details.embedding.length === 0
  ) {
    return 0;
  }

  if (card1.details.name === card2.details.name) {
    return 1;
  }

  const keys = cardNameKeys(card1.details.name, card2.details.name);
  if (!synergyCache[keys[0]]) {
    const similarityValue = similarity(card1.details.embedding, card2.details.embedding) ** 3;

    if (Number.isFinite(similarityValue)) {
      synergyCache[keys[0]] = similarityValue;
      synergyCache[keys[1]] = similarityValue;
    } else {
      synergyCache[keys[0]] = similarityValue > 0 ? 1 : 0;
    }
  }

  return synergyCache[keys[0]];
};

// quality of the card, based on Elo
export const getQuality = (cardList, card) => {
  const elos = cardList.map((c) => c.details.elo).filter((a) => a);
  const min = arrayMin(elos);
  return (cardList[card].details.elo - min) / (arrayMax(elos) - min);
};

// synergy of card with current pool
export const getSynergy = (cardList, card, picked) => {
  if (picked.length === 0) {
    return 0;
  }
  const pickSynergies = picked.map((p) => calculateSynergy(cardList[card], cardList[p]));

  return (pickSynergies.reduce((a, b) => a + b) / picked.length + arrayMax(pickSynergies)) / 2;
};

// how well this card fixes our mana
export const getFixing = (cardList, card, picked) => {
  if (producedMana(cardList[card]).length <= 1) {
    return 0;
  }

  // TODO: handle fetches case, and combination of fetches + fetchable

  // TODO: discount the resulting value by how badly this deck needs fixing. A mono white deck should have a very low coefficien, five colors should be = 1

  let filtered = picked.map((p) => cardList[p]);

  filtered = filtered.filter((c) => cardColors(c).length > 0 && cardCmc(c) > 0).map((c) => cardColors(c));

  if (filtered.length === 0) {
    return 1 - COLOR_PENALTY[producedMana(cardList[card]).length + 1];
  }

  return (
    filtered
      .map((colors) => {
        const intersection = arrayIntersection(colors, producedMana(cardList[card])).length;

        if (intersection >= 2) {
          return 1;
        }
        if (intersection > 0) {
          return 0.8;
        }
        return 1 - COLOR_PENALTY[producedMana(cardList[card]).length + 1];
      })
      .reduce((a, b) => a + b) / filtered.length
  );
};

// how well this card fits within our draft's colors
export const getColor = (cardList, card, picked) => {
  const filtered = picked
    .map((p) => cardList[p])
    .filter((c) => cardColorIdentity(c).length > 0 && cardCmc(c) > 0)
    .map((c) => cardColorIdentity(c));

  if (filtered.length === 0) {
    return COLOR_PENALTY[cardColorIdentity(cardList[card]).length];
  }

  return (
    filtered
      .map((colors) => COLOR_PENALTY[arrayDifference(colors, cardColorIdentity(cardList[card])).length])
      .reduce((a, b) => a + b) / picked.length
  );
};

// how open this card likely is
export const getOpenness = (cardList, card, seen) => {
  const filtered = seen.map((p) => cardColorIdentity(cardList[p])).filter((arr) => arr.length > 0);

  if (filtered.length === 0) {
    return COLOR_PENALTY[cardColorIdentity(cardList[card]).length];
  }

  return (
    filtered
      .map((colors) => COLOR_PENALTY[arrayDifference(colors, cardColorIdentity(cardList[card])).length])
      .reduce((a, b) => a + b) / seen.length
  );
};

export const getPickState = (draft, seatNumber, pickNumber = -1) => {
  let packNum = 0;
  const seatNum = parseInt(seatNumber, 10);

  // if pickNumber is -1, we want to use to most recent pick
  if (pickNumber === -1) {
    pickNumber = draft.seats[seatNum].pickorder.length;
  }
  let pickNum = parseInt(pickNumber, 10);
  const end = pickNum;

  let seen = [];

  while (pickNum >= draft.initial_state[seatNum][packNum].length) {
    pickNum -= draft.initial_state[seatNum][packNum].length;
    packNum += 1;

    if (packNum >= draft.initial_state[seatNum].length) {
      // we are actually done
      return {
        cardsInPack: [],
        picked: draft.seats[seatNum].pickorder,
        seen: [],
      };
    }
  }

  // for all previous finished packs, we need to populate seen
  let start = 0;
  for (let i = 0; i < packNum; i++) {
    const numCardsInPack = draft.initial_state[seatNum][i].length;
    for (let j = 0; j < draft.initial_state.length; j++) {
      let index;
      if (i % 2 === 0) {
        // we passed to left
        index = (seatNum + j) % draft.initial_state.length;
      } else {
        // we passed to right
        index = (seatNum + draft.initial_state.length - j) % draft.initial_state.length;
      }
      seen = seen.concat(draft.seats[index].pickorder.slice(start + j, start + numCardsInPack));
    }
    start += numCardsInPack;
  }

  // for the current unfinished pack, we need to populate seen
  const packs = [];
  for (let i = 0; i < draft.initial_state.length; i++) {
    packs.push(draft.initial_state[i][packNum]);
  }
  for (let i = start; i < end; i++) {
    for (let j = 0; j < draft.initial_state.length; j++) {
      let index;
      if (i % 2 === 0) {
        // pass left
        index = (seatNum + draft.initial_state.length - j) % draft.initial_state.length;
      } else {
        // pass right
        index = (seatNum + j) % draft.initial_state.length;
      }

      // here we have a seat index, and a pick index i
      // if a wheel is impossible - and this seat is our target seat - then we need to 'show' this pack to the target seat
      if (index === seatNumber && i - start < draft.initial_state.length) {
        seen = seen.concat(packs[seatNumber]);
      }
      // we need to determine the picked card and remove it from the packs
      if (!packs[index].includes(draft.seats[index].pickorder[i])) {
        console.error(
          `Seat ${index} should have picked ${
            draft.seats[index].pickorder[i]
          } at pick number ${i}, but the pack contains [${packs[index].join(', ')}]`,
        );
      }
      packs[index] = packs[index].filter((cardIndex) => cardIndex !== draft.seats[index].pickorder[i]);
    }
    // we need to rotate packs

    if (packNum % 2 === 0) {
      // pass left
      packs.splice(0, 0, packs.splice(packs.length - 1, 1)[0]);
    } else {
      // pass right
      packs.push(packs.splice(0, 1)[0]);
    }
  }

  return {
    cardsInPack: packs[seatNum],
    picked: draft.seats[seatNum].pickorder.slice(0, start + pickNumber),
    seen,
  };
};

export const buildDeck = (pool) => {
  return {
    main: [],
    sideboard: [],
  };
};

// returns a list of:
/*
{
  cardIndex: Number, // index from draft.cardsList
  packIndex: Number // index from source pack
  score: Number // resulting score
}
*/
export const getScores = (cardList, cardsInPack, picked, seen) => {
  return cardsInPack.map((item, index) => {
    const quality = getQuality(cardList, item);
    const synergy = getSynergy(cardList, item, picked);
    const color = getColor(cardList, item, picked);
    const openess = getOpenness(cardList, item, seen);
    const fixing = getFixing(cardList, item, picked);
    const score = (quality + synergy + color + openess + fixing) / 5;
    return { cardIndex: item, packIndex: index, score, quality, synergy, color, openess, fixing };
  });
};
