import { rotateDailyP1P1 } from '@server/serverutils/rotateDailyP1P1';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import { GeneratePackResult } from '@server/serverutils/cubefn';
import { cardFromId } from '@server/serverutils/carddb';

interface BotResult {
  botPickIndex: number | null;
  botWeights: number[];
}

/**
 * Get bot prediction from the CubeCobra API endpoint
 */
async function getBotPredictionFromAPI(oracleIds: string[]): Promise<BotResult> {
  try {
    const validOracleIds = oracleIds.filter(Boolean);

    if (validOracleIds.length === 0) {
      return { botPickIndex: null, botWeights: [] };
    }

    // Get the API base URL from environment variable
    const apiBaseUrl = process.env.API_BASE_URL || 'https://cubecobra.com';

    // Call the prediction API using fetch
    const response = await fetch(`${apiBaseUrl}/api/draftbots/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pack: validOracleIds,
        picks: [], // Empty picks for P1P1
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const predictions = data.prediction;

    if (!predictions || predictions.length === 0) {
      return { botPickIndex: null, botWeights: [] };
    }

    // Create weights array aligned with pack cards
    const botWeights = new Array(validOracleIds.length).fill(0);

    // Map prediction ratings to card positions
    predictions.forEach((prediction: any) => {
      const cardIndex = validOracleIds.findIndex((oracleId: string) => oracleId === prediction.oracle);
      if (cardIndex >= 0) {
        botWeights[cardIndex] = prediction.rating;
      }
    });

    // Find the highest rated card
    const topPick = predictions[0]; // Already sorted by rating descending
    if (!topPick) {
      return { botPickIndex: null, botWeights };
    }
    const botPickIndex = validOracleIds.findIndex((oracleId: string) => oracleId === topPick.oracle);

    return {
      botPickIndex: botPickIndex >= 0 ? botPickIndex : null,
      botWeights,
    };
  } catch (error) {
    console.error('Error getting bot prediction from API:', error);
    // Return empty result on error
    return { botPickIndex: null, botWeights: [] };
  }
}

/**
 * Lambda-specific pack generation strategy that uses the API for bot predictions
 */
async function generatePackForLambda(
  cube: any,
  cards: any,
  seedPrefix: string,
  candidateCount: number = 10,
  deterministicSeed: number | null = null,
): Promise<GeneratePackResult> {
  // Use deterministicSeed if provided (for routes), otherwise use Date.now() (for daily P1P1)
  const baseSeed = deterministicSeed || Date.now();
  const packCandidates = [];

  for (let i = 0; i < candidateCount; i++) {
    const seed = `${seedPrefix}-${baseSeed}-${i}`;
    const formatId = cube.defaultFormat === undefined ? -1 : cube.defaultFormat;
    const format = getDraftFormat({ id: formatId, packs: 1, players: 1 }, cube);
    const draft = createDraft(cube, format, [...cards.mainboard], 1, { username: 'Anonymous' } as any, seed);
    const packResult = {
      seed: seedPrefix,
      pack:
        draft.InitialState?.[0]?.[0]?.cards.map((cardIndex: number) => {
          const card = draft.cards![cardIndex];
          return {
            ...card,
            details: card ? cardFromId(card.cardID) : undefined,
          };
        }) ?? [],
    };

    // Extract oracle IDs for bot prediction
    const oracleIds = packResult.pack.map((card: any) => card.details?.oracle_id).filter(Boolean);

    // Get bot prediction from API
    const botResult = await getBotPredictionFromAPI(oracleIds);

    // Calculate the maximum bot weight for this pack
    const maxBotWeight = Math.max(...(botResult.botWeights.length > 0 ? botResult.botWeights : [0]));

    packCandidates.push({
      packResult,
      botResult,
      maxBotWeight,
      seed: seedPrefix, // Use original seedPrefix for consistency
    });
  }

  // Select the pack with the lowest maximum bot weight
  const selectedCandidate = packCandidates.reduce((best, current) =>
    current.maxBotWeight < best.maxBotWeight ? current : best,
  );

  return selectedCandidate.packResult;
}

export const rotateP1P1 = async () => {
  try {
    // Use the Lambda-specific strategy that calls the API endpoint
    const result = await rotateDailyP1P1(generatePackForLambda);
    if (result.success) {
      console.log('Daily P1P1 rotation completed successfully.');
    } else {
      console.error('Daily P1P1 rotation failed:', result.message);
    }
  } catch (error) {
    console.error('Daily P1P1 rotation error:', error);
  }
};
