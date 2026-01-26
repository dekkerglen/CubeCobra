import { draft } from 'serverutils/ml';

/**
 * Utility functions for handling user data in P1P1 packs
 */

interface BotPrediction {
  oracle: string;
  rating: number;
}

interface BotResult {
  botPickIndex: number | null;
  botWeights: number[];
}

/**
 * Get bot prediction for a pack of oracle IDs
 */
export const getBotPrediction = async (oracleIds: string[]): Promise<BotResult> => {
  try {
    const validOracleIds = oracleIds.filter(Boolean);

    if (validOracleIds.length === 0) {
      return { botPickIndex: null, botWeights: [] };
    }

    // Call the draft function directly instead of making HTTP request
    const predictions: BotPrediction[] = await draft(validOracleIds, []); // Empty picks for P1P1

    if (!predictions || predictions.length === 0) {
      return { botPickIndex: null, botWeights: [] };
    }

    // Create weights array aligned with pack cards
    const botWeights = new Array(validOracleIds.length).fill(0);

    // Map prediction ratings to card positions
    predictions.forEach((prediction) => {
      const cardIndex = validOracleIds.findIndex((oracleId) => oracleId === prediction.oracle);
      if (cardIndex >= 0) {
        botWeights[cardIndex] = prediction.rating;
      }
    });

    // Find the highest rated card
    const topPick = predictions[0]; // Already sorted by rating descending
    if (!topPick) {
      return { botPickIndex: null, botWeights };
    }
    const botPickIndex = validOracleIds.findIndex((oracleId) => oracleId === topPick.oracle);

    return {
      botPickIndex: botPickIndex >= 0 ? botPickIndex : null,
      botWeights,
    };
  } catch {
    // Silently fail for bot predictions to avoid breaking pack creation
    return { botPickIndex: null, botWeights: [] };
  }
};
