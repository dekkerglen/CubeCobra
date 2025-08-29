import { CardDetails } from './Card';

export interface P1P1Vote {
  userId: string; // Added back during hydration from map key
  userName: string;
  cardIndex: number;
  date: number;
}

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

export interface P1P1Pack {
  id: string;
  cubeId: string;
  cards: CardDetails[]; // Full card details for frontend display
  seed: string;
  date: number;
  createdBy: string;
  createdByUsername: string;
  votes: P1P1Vote[]; // Embedded votes
  botPick?: number; // Index of card CubeCobra bot picked (computed at creation)
  botWeights?: number[]; // Array of bot rating weights for each card (computed at creation)
}

export interface UnhydratedP1P1Pack {
  id?: string;
  cubeId: string;
  cards: string[]; // Store card IDs in database to preserve specific printings
  seed: string;
  date?: number;
  createdBy: string;
  createdByUsername: string;
  botPick?: number;
  botWeights?: number[];
}

export default P1P1Pack;
