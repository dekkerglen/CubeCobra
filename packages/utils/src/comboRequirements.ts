import { cardOracleId } from './cardutil';
import Card from './datatypes/Card';
import { Combo } from './datatypes/CardCatalog';
import { FilterFunction, makeFilter } from './filtering/FilterCards';

type ComboRequirement = Combo['requires'][number];

// Scryfall binds AND tighter than OR ("a or b c" is "a or (b and c)") while our filters read left to right ("(a or
// b) and c"), so parenthesize both sides of every OR. Quoted strings and /regexes/ are copied through untouched.
// Returns the query unchanged if its parentheses don't balance.
export const groupOrOperands = (query: string): string => {
  let pos = 0;

  const copyDelimited = (close: string): string => {
    const start = pos;
    pos += 1;
    while (pos < query.length && query[pos] !== close) {
      pos += query[pos] === '\\' ? 2 : 1;
    }
    pos += 1;
    return query.slice(start, pos);
  };

  const parseGroup = (): string => {
    const operands: string[] = [];
    let current = '';
    while (pos < query.length) {
      const char = query[pos]!;
      if (char === ')') {
        break;
      }
      if (char === '(') {
        pos += 1;
        const inner = parseGroup();
        if (query[pos] !== ')') {
          throw new Error('Unbalanced parentheses');
        }
        pos += 1;
        current += `(${inner})`;
      } else if (char === '"' || char === "'" || (char === '/' && current.endsWith(':'))) {
        current += copyDelimited(char);
      } else {
        const or = /^\s+or\s+/i.exec(query.slice(pos));
        if (or) {
          operands.push(current.trim());
          current = '';
          pos += or[0].length;
        } else {
          current += char;
          pos += 1;
        }
      }
    }
    operands.push(current.trim());
    return operands.length > 1 ? operands.map((operand) => `(${operand})`).join(' or ') : operands[0]!;
  };

  try {
    const grouped = parseGroup();
    return pos === query.length ? grouped : query;
  } catch {
    return query;
  }
};

// A Spellbook query as our filter syntax: typographic apostrophes straightened (oracle text uses straight ones) and
// ORs grouped so it reads as it does on Scryfall.
export const templateFilterText = (query: string): string => groupOrOperands(query.replace(/[‘’]/g, "'"));

const compiledTemplates = new Map<string, FilterFunction | null>();

// Commander Spellbook describes each non-specific combo piece ("a creature with persist") by a Scryfall query.
// Returns null when there is no query or it uses syntax our filters don't support, i.e. the piece can't be checked.
export const compileTemplateQuery = (query: string | null | undefined): FilterFunction | null => {
  if (!query) {
    return null;
  }
  if (!compiledTemplates.has(query)) {
    const { err, filter } = makeFilter(templateFilterText(query));
    compiledTemplates.set(query, err ? null : filter);
  }
  return compiledTemplates.get(query) ?? null;
};

// Scryfall's o: leaves out reminder text, so template queries are matched against a copy of each card without it.
const withoutReminderText = new WeakMap<Card, Card>();

const asScryfallSees = (card: Card): Card => {
  let stripped = withoutReminderText.get(card);
  if (!stripped) {
    stripped = card.details
      ? {
          ...card,
          details: { ...card.details, oracle_text: (card.details.oracle_text ?? '').replace(/ *\([^()]*\)/g, '') },
        }
      : card;
    withoutReminderText.set(card, stripped);
  }
  return stripped;
};

export interface RequirementMatch {
  requirement: ComboRequirement;
  // Distinct cards that can fill the slot, or null when the requirement can't be checked.
  cards: Card[] | null;
}

// Cards named by the combo itself can't also fill one of its open slots.
export const matchComboRequirements = (combo: Combo, cards: Card[]): RequirementMatch[] => {
  const named = new Set((combo.uses ?? []).map((use) => use?.card?.oracleId));
  const seen = new Set<string>();
  const candidates = cards.filter((card) => {
    const oracleId = cardOracleId(card);
    if (named.has(oracleId) || seen.has(oracleId)) {
      return false;
    }
    seen.add(oracleId);
    return true;
  });

  return (combo.requires ?? []).map((requirement) => {
    const filter = compileTemplateQuery(requirement?.template?.scryfallQuery);
    return { requirement, cards: filter ? candidates.filter((card) => filter(asScryfallSees(card))) : null };
  });
};

// A requirement that can't be checked counts as met, so a combo is only hidden when it definitely can't be assembled.
export const requirementsAreMet = (matches: RequirementMatch[]): boolean =>
  matches.every(({ requirement, cards }) => cards === null || cards.length >= Math.max(1, requirement?.quantity ?? 1));
