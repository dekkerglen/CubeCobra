import Card from 'datatypes/Card';

export interface Step {
  action: 'pass' | 'pick' | 'pickrandom' | 'trash' | 'trashrandom';
  amount?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;

interface DrafterState {
  cards: Card[];
  picked: number[];
  trashed: number[];
  seen?: number[];
  cardsInPack: number[];
  packNum: number;
  pickNum: number;
  numPacks: number;
  packSize: number;
  pickedNum: number;
  trashedNum: number;
  stepNumber: number;
  pickNumber: number;
  step?: Step;
}

export type Color = (typeof COLORS)[number];

export interface BotState extends DrafterState {
  cardIndex: number;
  probabilities?: Record<string, unknown>;
}

export interface Oracle {
  title: string;
  tooltip?: string;
  perConsideredCard?: boolean;
  weights: number[][];
  computeWeight: (state: DrafterState) => number;
  computeValue: (state: BotState) => number;
}

export interface OracleResult {
  title: string;
  tooltip?: string;
  weight: number;
  value: number;
}

export interface BotEvaluation {
  score: number;
  oracleResults: OracleResult[];
  totalProbability?: number;
}

export interface Pack {
  cards: number[];
  steps?: Step[];
}

export interface Seat {
  bot?: boolean;
  name: string;
  userid?: string;
  mainboard: number[][][];
  sideboard: number[][][];
  pickorder: number[];
  trashorder: number[];
}

export default DrafterState;
