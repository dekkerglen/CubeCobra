import Papa from 'papaparse';

export interface RotoPlayer {
  name: string;
  index: number;
}

export interface RotoPick {
  cardName: string;
  playerName: string;
  playerIndex: number;
  cardCopyIndex: number; // Index for this copy of the card (1-based)
  overallPickNumber: number; // Overall pick number in the draft
  playerPickNumber: number; // Pick number for this specific player
}

const NAME_ROW_INDEX = 2;
const FIRST_NAME_COLUMN_INDEX = 2;
const FIRST_PICK_ROW_INDEX = 3;
const MAX_PLAYERS = 8;
const LEFT_ARROW_COLUMN_INDEX = 1;
const RIGHT_ARROW_COLUMN_INDEX = LEFT_ARROW_COLUMN_INDEX + MAX_PLAYERS + 1;
const DOUBLE_PICKS_AFTER_ROW = 4;
const DOUBLE_PICKS_AFTER_COLUMN = 15;

const getPicksForPlayer = ({
  column,
  doublePicks,
  parsedCSV,
  playerName,
  row,
  cardCopyTracker,
  playerPicksByIndex,
}: {
  column: number;
  doublePicks: boolean;
  parsedCSV: string[][];
  playerName: string;
  row: number;
  cardCopyTracker: Record<string, number>;
  playerPicksByIndex: RotoPick[];
}) => {
  const pickRows = doublePicks ? [row, row + 1] : [row];

  const picks = pickRows.map((rowIndex) => {
    if (rowIndex + 1 >= parsedCSV.length) return undefined;

    const cardName = parsedCSV[rowIndex]?.[column];

    if (!cardName || typeof cardName !== 'string') {
      return undefined;
    }

    const trimmedCardName = cardName.trim();
    const baseCardName = trimmedCardName.replace(/ \d+$/, '').toLowerCase();

    // Increment the copy index for this base card name
    if (!cardCopyTracker[baseCardName]) {
      cardCopyTracker[baseCardName] = 1;
    } else {
      cardCopyTracker[baseCardName] += 1;
    }

    const playerPickNumber = playerPicksByIndex.length + 1;

    return {
      cardName: trimmedCardName,
      playerIndex: column,
      playerName,
      cardCopyIndex: cardCopyTracker[baseCardName],
      overallPickNumber: 0, // Will be set later
      playerPickNumber,
    } as RotoPick;
  });

  return picks;
};

/**
 * Parses a Roto Draft CSV from a Google Sheet with a well known format.
 * @param csv
 */
export const parseRotoCSV = (csv: string) => {
  const { data: parsedCSV } = Papa.parse(csv.trim()) as { data: string[][] };

  const nameRow = parsedCSV[NAME_ROW_INDEX];
  const players: Record<string, RotoPlayer> = {};
  const picks: Record<string, RotoPick> = {};
  const picksByPlayer: Record<string, RotoPick[]> = {};

  // Track card copy indexes globally
  const cardCopyTracker: Record<string, number> = {};
  let overallPickNumber = 1;

  // Initialize the players from the row with player names
  if (!nameRow) return { players: {}, picks: {}, picksByPlayer: {} };

  for (let i = FIRST_NAME_COLUMN_INDEX; i < nameRow.length; i++) {
    const playerName = nameRow[i]?.replace(/[^a-zA-Z0-9 ]/g, '').trim();

    if (!playerName) break;

    players[i] = { name: playerName, index: i };
    picksByPlayer[i] = [];
  }

  const numPlayers = Object.keys(players).length;
  const DOUBLE_PICKS_AFTER = parseInt(parsedCSV[DOUBLE_PICKS_AFTER_ROW]?.[DOUBLE_PICKS_AFTER_COLUMN] ?? '999');
  let draftDirection: 'left' | 'right' = 'right';

  // Traverse each row of picks, adding them to our picks object
  for (
    let i = FIRST_PICK_ROW_INDEX;
    i < parsedCSV.length;
    i + 1 - FIRST_PICK_ROW_INDEX > DOUBLE_PICKS_AFTER ? (i = i + 2) : (i += 1)
  ) {
    const doublePicks = i + 1 - FIRST_PICK_ROW_INDEX > DOUBLE_PICKS_AFTER;
    const pickRow = parsedCSV[i];

    const draftingRight = draftDirection === 'right';
    const leftmostPickIndex = LEFT_ARROW_COLUMN_INDEX + 1;
    const rightmostPickIndex = LEFT_ARROW_COLUMN_INDEX + numPlayers;
    const startIndex = draftingRight ? leftmostPickIndex : rightmostPickIndex;
    const endIndex = draftingRight ? rightmostPickIndex : leftmostPickIndex;
    const blankInRow = false;

    // Go through each pick for this row in the correct drafting direction
    for (let n = startIndex; draftingRight ? n <= endIndex : n >= endIndex; draftingRight ? (n += 1) : (n -= 1)) {
      const player = players[n];
      if (!player) continue;

      const playerPicksForIndex = picksByPlayer[n];
      if (!playerPicksForIndex) continue;

      const playerPicks = getPicksForPlayer({
        column: n,
        doublePicks,
        parsedCSV,
        playerName: player.name,
        row: i,
        cardCopyTracker,
        playerPicksByIndex: playerPicksForIndex,
      }).filter((pick) => pick !== undefined);

      playerPicks.forEach((playerPick) => {
        // Set the overall pick number
        playerPick.overallPickNumber = overallPickNumber;
        overallPickNumber += 1;

        // Create a unique key for each card pick that includes the copy index
        const pickKey = `${playerPick.cardName.toLowerCase()}_${playerPick.cardCopyIndex}`;
        picks[pickKey] = playerPick;
      });

      const existingPicks = picksByPlayer[n] ?? [];
      picksByPlayer[n] = existingPicks.concat(playerPicks);
    }

    // We found a blank pick in the row, this might be the last row
    if (blankInRow) {
      // Check for data in the next row, which can happen if we're on double picks
      const nextRow = parsedCSV[i + 1];
      const startPickNextRow = nextRow?.[startIndex];

      // If the start of the next row is empty then we can assume the whole row is empty
      if (startPickNextRow === '') break;
    }

    // Swap the direction if there's an arrow at the end to snake the draft
    if (!pickRow) continue;

    if (draftingRight && pickRow[RIGHT_ARROW_COLUMN_INDEX] === '↩') {
      draftDirection = 'left';
    } else if (!draftingRight && pickRow[LEFT_ARROW_COLUMN_INDEX] === '↪') {
      draftDirection = 'right';
    }
  }

  return {
    players,
    picks,
    picksByPlayer,
  };
};
