import Card from './Card';

export interface P1P1VoteResult {
  cardIndex: number;
  voteCount: number;
  percentage: number;
}

export interface P1P1VoteSummary {
  totalVotes: number;
  results: P1P1VoteResult[];
  userVote?: number; // Index of card user voted for
  botPick?: number; // Index of card CubeCobra bot picked
  botWeights?: number[]; // Array of bot rating weights for each card (0-1 range)
}

/**
 * P1P1 pack structure.
 * Data is split between DynamoDB (id, createdBy, cubeId, date, votesByUser)
 * and S3 (cards, seed, botPick, botWeights, createdByUsername) for cost optimization.
 */
export interface P1P1Pack {
  // DynamoDB fields
  id: string;
  createdBy: string;
  cubeId: string;
  date: number;
  votesByUser: Record<string, number>; // Map of userId to cardIndex

  // S3 fields
  botPick?: number; // Index of card CubeCobra bot picked
  botWeights?: number[]; // Array of bot rating weights for each card
  cards: Card[]; // Basic card data for each card in the pack
  createdByUsername: string;
  seed: string;
}

/**
 * DynamoDB fields only (what gets stored in the table)
 */
export type P1P1PackDynamoData = Pick<P1P1Pack, 'id' | 'createdBy' | 'cubeId' | 'date' | 'votesByUser'>;

/**
 * S3 fields only (what gets stored in S3)
 */
export type P1P1PackS3Data = Pick<P1P1Pack, 'botPick' | 'botWeights' | 'cards' | 'createdByUsername' | 'seed'>;
