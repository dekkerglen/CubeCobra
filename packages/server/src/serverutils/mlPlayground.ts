// Shared plumbing for the ML Playground tool (/tool/mlplayground): turning pasted card lists into
// the oracle ids the model is given, and mapping the model's answers back onto the pasted cards.
//
// Every playground mode resolves its lists the same way so the page can show, per card, what the
// model actually saw: the card itself, the stand-in getOracleForMl picks for a card the model was
// never trained on, or nothing at all.
import {
  CardDetails,
  DefaultPrintingPreference,
  isPrintingPreference,
  PrintingPreference,
} from '@utils/datatypes/Card';

import type { Request, Response } from '../types/express';
import catalog from './cardCatalog';
import { cardFromId, getIdsFromName, getMostReasonable, getOracleForMl, getReasonableCardByOracle } from './carddb';
import { parseNonCSVLine } from './importParsing';
import { isMlServiceError } from './ml';

// Most lines one pasted list may hold, and the longest text it may be. Room for a large cube.
export const MAX_LIST_LINES = 2000;
export const MAX_LIST_TEXT_LENGTH = 200_000;

// Section headers that decklist exports (MTGO, Arena, Moxfield, ...) put between card lines.
const SECTION_HEADER = /^(deck|main ?deck|mainboard|sideboard|maybeboard|commander|companion)$/i;

// What the model is given for a pasted card.
//   known       - the card is in the model's vocabulary.
//   substituted - it isn't, and the most similar card the model knows stands in for it.
//   unknown     - it isn't, and nothing stands in for it, so the model never sees it.
export type ModelStatus = 'known' | 'substituted' | 'unknown';

export interface PlaygroundCard {
  cardID: string;
  oracle: string;
  name: string;
  count: number;
  status: ModelStatus;
  // A printing of the stand-in, when the card is substituted.
  substituteID?: string;
  substituteName?: string;
}

export interface ListSummary {
  cards: PlaygroundCard[];
  // Pasted lines that matched no card.
  missing: string[];
}

export interface ResolvedList extends ListSummary {
  details: Map<string, CardDetails>;
  // The oracle the model is given for each pasted oracle.
  toMl: Record<string, string>;
  // Every pasted oracle behind each oracle the model is given.
  fromMl: Record<string, string[]>;
}

export interface ResolveOptions {
  substitute: boolean;
  printing: PrintingPreference;
}

export class ListInputError extends Error {}

// A set code (and collector number) picks that printing when one exists; otherwise the name's
// preferred printing is used.
const resolveLine = (
  name: string,
  set: string | undefined,
  collectorNumber: string | undefined,
  printing: PrintingPreference,
): CardDetails | null => {
  if (set) {
    const ids = getIdsFromName(name);
    const upperSet = set.toUpperCase();
    const upperNumber = collectorNumber?.toUpperCase();
    const inSet = ids.filter((id) => cardFromId(id).set.toUpperCase() === upperSet);
    const exact = upperNumber
      ? inSet.find((id) => cardFromId(id).collector_number.toUpperCase() === upperNumber)
      : undefined;
    const id = exact ?? inSet[0];
    if (id) {
      return cardFromId(id);
    }
  }
  return getMostReasonable(name, printing);
};

/**
 * Parses a pasted list (one card per line, in any of the plain text import shapes) into unique
 * cards, keeping the order cards first appear in and summing their counts.
 */
export const resolveList = (text: unknown, { substitute, printing }: ResolveOptions): ResolvedList => {
  if (text === undefined || text === null) {
    text = '';
  }
  if (typeof text !== 'string') {
    throw new ListInputError('Card lists must be text.');
  }
  if (text.length > MAX_LIST_TEXT_LENGTH) {
    throw new ListInputError('This list is too long.');
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_LIST_LINES) {
    throw new ListInputError(`Lists can have at most ${MAX_LIST_LINES.toLocaleString('en-US')} lines.`);
  }

  const cards: PlaygroundCard[] = [];
  const byOracle = new Map<string, PlaygroundCard>();
  const details = new Map<string, CardDetails>();
  const missing: string[] = [];
  const toMl: Record<string, string> = {};
  const fromMl: Record<string, string[]> = {};

  for (const rawLine of lines) {
    // Moxfield marks foils and etched printings with a trailing *F* / *E*.
    const line = rawLine.trim().replace(/\s+\*[A-Z]\*$/i, '');
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    if (SECTION_HEADER.test(line.replace(/:$/, ''))) continue;

    const parsed = parseNonCSVLine(line);
    if (!parsed) continue;

    const card = resolveLine(parsed.name, parsed.set, parsed.collectorNumber, printing);
    if (!card || card.error || !card.oracle_id) {
      missing.push(line);
      continue;
    }

    const existing = byOracle.get(card.oracle_id);
    if (existing) {
      existing.count += parsed.count;
      continue;
    }

    const oracle = card.oracle_id;
    let mlOracle = oracle;
    let status: ModelStatus = 'known';
    let standInCard: CardDetails | undefined;
    if (catalog.oracleToIndex[oracle] === undefined) {
      status = 'unknown';
      if (substitute) {
        const standIn = getOracleForMl(oracle, null);
        if (standIn !== oracle) {
          mlOracle = standIn;
          status = 'substituted';
          standInCard = getReasonableCardByOracle(standIn);
        }
      }
    }

    const entry: PlaygroundCard = {
      cardID: card.scryfall_id,
      oracle,
      name: card.name,
      count: parsed.count,
      status,
      ...(standInCard ? { substituteID: standInCard.scryfall_id, substituteName: standInCard.name } : {}),
    };
    cards.push(entry);
    byOracle.set(oracle, entry);
    details.set(oracle, card);
    toMl[oracle] = mlOracle;
    (fromMl[mlOracle] ??= []).push(oracle);
  }

  return { cards, missing, details, toMl, fromMl };
};

/** The part of a resolved list the page shows. */
export const summarize = ({ cards, missing }: ResolvedList): ListSummary => ({ cards, missing });

/** The distinct oracles the model is given for a list, in list order. */
export const modelOracles = (list: ResolvedList, keep?: (card: PlaygroundCard) => boolean): string[] => {
  const seen = new Set<string>();
  for (const card of list.cards) {
    if (keep && !keep(card)) continue;
    seen.add(list.toMl[card.oracle] ?? card.oracle);
  }
  return [...seen];
};

export interface RatedPlaygroundCard {
  cardID: string;
  oracle: string;
  name: string;
  // null when the model gave this card no rating.
  rating: number | null;
}

/**
 * Maps ratings the model gave its own oracles back onto the pasted cards they stand for, best
 * first. Pasted cards that got no rating come last, with a null rating.
 */
export const ratePastedCards = (
  list: ResolvedList,
  rated: { oracle: string; rating: number }[],
  descending = true,
): RatedPlaygroundCard[] => {
  const byCard = new Map(list.cards.map((card) => [card.oracle, card]));
  const result: RatedPlaygroundCard[] = [];
  const seen = new Set<string>();
  const ordered = [...rated].sort((a, b) => (descending ? b.rating - a.rating : a.rating - b.rating));
  for (const item of ordered) {
    for (const oracle of list.fromMl[item.oracle] ?? []) {
      const card = byCard.get(oracle);
      if (!card || seen.has(oracle)) continue;
      seen.add(oracle);
      result.push({ cardID: card.cardID, oracle, name: card.name, rating: item.rating });
    }
  }
  for (const card of list.cards) {
    if (!seen.has(card.oracle)) {
      result.push({ cardID: card.cardID, oracle: card.oracle, name: card.name, rating: null });
    }
  }
  return result;
};

export const isBasicLand = (card: CardDetails | undefined): boolean => {
  const type = card?.type ?? '';
  return type.includes('Basic') && type.includes('Land');
};

/** The printing pasted names resolve to: the user's preference, else the site default. */
export const playgroundPrinting = (req: Request): PrintingPreference => {
  const preference = req.user?.defaultPrinting;
  return isPrintingPreference(preference) ? preference : DefaultPrintingPreference;
};

/**
 * Answers a failed playground request: 400 for a bad list, 503 when the recommender is down (a
 * transient outage, logged at info), 500 otherwise.
 */
export const sendPlaygroundError = (req: Request, res: Response, err: unknown, context: string) => {
  if (err instanceof ListInputError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (isMlServiceError(err)) {
    req.logger.info(`${context}: ML service unavailable`, err instanceof Error ? err.stack : String(err));
    return res.status(503).json({
      success: false,
      mlUnavailable: true,
      message: 'The card recommender is temporarily unavailable. Please try again in a moment.',
    });
  }
  const error = err as Error;
  req.logger.error(`${context}: ${error?.message}`, error?.stack);
  return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
};
