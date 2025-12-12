import { PrintingPreference } from '@utils/datatypes/Card';
import { cubeDao } from 'dynamo/daos';
import { SortOrder as DaoSortOrder } from 'dynamo/dao/CubeDynamoDao';
import { getMostReasonable, getReasonableCardByOracle } from 'serverutils/carddb';
import { isCubeListed } from 'serverutils/cubefn';
import { render } from 'serverutils/render';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';

import { Request, Response } from '../../types/express';

type SortOrder = 'pop' | 'alpha' | 'cards';

interface CardQuery {
  type: 'card' | 'oracle';
  value: string;
}

interface KeywordQuery {
  type: 'keywords';
  value: string;
}

interface TagQuery {
  type: 'tag';
  value: string;
}

interface SizeQuery {
  type: 'size';
  operator: 'eq' | 'gt' | 'lt';
  value: number;
}

const tokenize = (query: string): string[] => {
  const tokens: string[] = [];
  let buffer = '';
  let inQuote = false;

  for (let i = 0; i < query.length; i++) {
    if (query[i] === '"') {
      inQuote = !inQuote;
      if (!inQuote) {
        // end of quote
        tokens.push(buffer);
        buffer = '';
      }
    } else if (query[i] === ' ' && !inQuote) {
      if (buffer.length > 0) {
        tokens.push(buffer);
        buffer = '';
      }
    } else {
      buffer += query[i];
    }
  }

  if (buffer.length > 0) {
    tokens.push(buffer);
  }

  return tokens;
};

const getCardQueries = (tokens: string[], printing: PrintingPreference = PrintingPreference.RECENT): CardQuery[] => {
  const queries: CardQuery[] = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'oracle' && split[1]) {
      queries.push({ type: 'oracle', value: split[1] });
    }

    if (split[0] === 'card' && split[1]) {
      const card = getMostReasonable(split[1], printing);

      if (card) {
        queries.push({ type: 'card', value: card.oracle_id });
      } else {
        queries.push({ type: 'card', value: '' });
      }
    }
  }

  return queries;
};

const getKeywordQueries = (tokens: string[]): KeywordQuery[] => {
  const queries: KeywordQuery[] = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'keywords' && split[1]) {
      queries.push({ type: 'keywords', value: split[1] });
    }

    if (split.length === 1 && split[0] && split[0].length > 0) {
      queries.push({ type: 'keywords', value: split[0] });
    }
  }

  return queries;
};

const getTagQueries = (tokens: string[]): TagQuery[] => {
  const queries: TagQuery[] = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'tag' && split[1]) {
      queries.push({ type: 'tag', value: split[1] });
    }
  }

  return queries;
};

const getSizeQueries = (tokens: string[]): SizeQuery[] => {
  const queries: SizeQuery[] = [];

  for (const token of tokens) {
    // Support both "size>250" and "cards=399" syntax
    const sizeMatch = token.match(/^(?:size|cards)([><=])(\d+)$/i);

    if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
      const operator = sizeMatch[1];
      const value = parseInt(sizeMatch[2], 10);

      let op: 'eq' | 'gt' | 'lt';
      if (operator === '=') {
        op = 'eq';
      } else if (operator === '>') {
        op = 'gt';
      } else if (operator === '<') {
        op = 'lt';
      } else {
        continue;
      }

      queries.push({ type: 'size', operator: op, value });
    }
  }

  return queries;
};

const getHumanReadableQuery = (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  tagQueries: TagQuery[],
  sizeQueries: SizeQuery[],
): string[] => {
  const result: string[] = [];

  for (const query of cardQueries) {
    if (query.value === '') {
      result.push(`Ignoring card query: could not identify card`);
    } else {
      const card = getReasonableCardByOracle(query.value);
      result.push(`Cube contains ${card.name}`);
    }
  }

  for (const query of keywordQueries) {
    result.push(`Cube name contains "${query.value}"`);
  }

  for (const query of tagQueries) {
    result.push(`Cube has tag "${query.value}"`);
  }

  for (const query of sizeQueries) {
    const opText = query.operator === 'eq' ? '=' : query.operator === 'gt' ? '>' : '<';
    result.push(`Cube size ${opText} ${query.value} cards`);
  }

  if (result.length === 0) {
    result.push('All cubes');
  }

  return result;
};

interface SearchResult {
  cubes: any[];
  lastKey: any;
  error?: string;
}

/**
 * Map the legacy SortOrder type to the DAO SortOrder type
 */
const mapSortOrder = (order: SortOrder): DaoSortOrder => {
  switch (order) {
    case 'pop':
      return 'popularity';
    case 'alpha':
      return 'alphabetical';
    case 'cards':
      return 'cards';
    default:
      return 'popularity';
  }
};

/**
 * Build the hashes array for queryByMultipleHashes based on parsed queries
 */
const buildHashesForQuery = (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  tagQueries: TagQuery[],
): string[] => {
  const hashes: string[] = [];

  // Add oracle hashes for card queries
  for (const query of cardQueries) {
    if (query.value && query.value !== '') {
      hashes.push(`oracle:${query.value}`);
    }
  }

  // Add tag hashes for tag queries
  for (const query of tagQueries) {
    hashes.push(`tag:${query.value.toLowerCase()}`);
  }

  // Add keyword hashes for keyword queries
  // Note: For multiple keywords, we'll use the first one as primary hash
  // and filter the rest in memory
  if (keywordQueries.length > 0 && keywordQueries[0]) {
    hashes.push(`keywords:${keywordQueries[0].value.toLowerCase()}`);
  }

  // If no hashes, return empty array - performSearch will handle this case
  // by querying all public cubes via queryByVisibility
  return hashes;
};

const performSearch = async (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  tagQueries: TagQuery[],
  sizeQueries: SizeQuery[],
  order: SortOrder,
  ascending: boolean,
  user: any,
  lastKey?: any,
): Promise<SearchResult> => {
  // Check for unsupported combinations
  if (cardQueries.length > 10) {
    return {
      error: 'Can only search for up to 10 cards at a time',
      cubes: [],
      lastKey: null,
    };
  }

  if (tagQueries.length > 10) {
    return {
      error: 'Can only search for up to 10 tags at a time',
      cubes: [],
      lastKey: null,
    };
  }

  const hashes = buildHashesForQuery(cardQueries, keywordQueries, tagQueries);

  if (hashes.length > 10) {
    return {
      error: 'Search query is too complex (max 10 combined card/tag/keyword filters)',
      cubes: [],
      lastKey: null,
    };
  }

  // Build card count filter from size queries
  let cardCountFilter: { operator: 'eq' | 'gt' | 'lt'; value: number } | undefined;
  if (sizeQueries.length > 0 && sizeQueries[0]) {
    cardCountFilter = {
      operator: sizeQueries[0].operator,
      value: sizeQueries[0].value,
    };
  }

  try {
    let cubes: any[];
    let resultLastKey: any = null;

    // If no specific queries, get all public cubes via visibility query
    if (hashes.length === 0) {
      console.log('[Search] No hashes, querying all public cubes', { lastKey });
      // Query for all public cubes using queryByVisibility (single page only)
      const result = await cubeDao.queryByVisibility(
        CUBE_VISIBILITY.PUBLIC,
        mapSortOrder(order),
        ascending,
        lastKey || undefined,
        36,
      );
      console.log(`[Search] Found ${result.items.length} public cubes`);
      cubes = result.items;
      resultLastKey = result.lastKey;

      // Apply card count filter if present
      if (cardCountFilter) {
        cubes = cubes.filter((cube: any) => {
          const cardCount = cube.cardCount || 0;
          switch (cardCountFilter.operator) {
            case 'eq':
              return cardCount === cardCountFilter.value;
            case 'gt':
              return cardCount > cardCountFilter.value;
            case 'lt':
              return cardCount < cardCountFilter.value;
            default:
              return true;
          }
        });
      }
    } else {
      // Use queryByMultipleHashes from cubeDao
      cubes = await cubeDao.queryByMultipleHashes(hashes, mapSortOrder(order), ascending, cardCountFilter);
      // Note: queryByMultipleHashes doesn't support pagination yet
      resultLastKey = null;
    }

    // Filter by listing visibility
    const visibleCubes = cubes.filter((cube: any) => isCubeListed(cube, user));
    console.log(`[Search] After visibility filter: ${visibleCubes.length} cubes`);

    // Apply additional keyword filters (for keywords beyond the first one)
    let filteredCubes = visibleCubes;
    if (keywordQueries.length > 1) {
      filteredCubes = visibleCubes.filter((cube: any) => {
        const cubeName = cube.name.toLowerCase();
        for (let i = 1; i < keywordQueries.length; i++) {
          const query = keywordQueries[i];
          if (query && !cubeName.includes(query.value.toLowerCase())) {
            return false;
          }
        }
        return true;
      });
      console.log(`[Search] After keyword filter: ${filteredCubes.length} cubes`);
    }

    // Limit to 36 results per page
    const paginatedCubes = filteredCubes.slice(0, 36);
    console.log(`[Search] Final paginated result: ${paginatedCubes.length} cubes`);

    return {
      cubes: paginatedCubes,
      lastKey: resultLastKey,
    };
  } catch (error: any) {
    return {
      error: error.message || 'An error occurred during search',
      cubes: [],
      lastKey: null,
    };
  }
};

interface SearchCubesResult {
  cubes: any[];
  lastKey: any;
  parsedQuery: string[];
  error?: string;
}

const searchCubes = async (
  query: string,
  order: SortOrder,
  lastKey: any,
  ascending: boolean,
  user: any,
): Promise<SearchCubesResult> => {
  // separate query into tokens, respecting quotes
  const tokens = tokenize(query);
  console.log('[Search] Query:', query, 'Tokens:', tokens);

  const cardQueries = getCardQueries(tokens, user?.defaultPrinting);
  const keywordQueries = getKeywordQueries(tokens);
  const tagQueries = getTagQueries(tokens);
  const sizeQueries = getSizeQueries(tokens);

  console.log('[Search] Parsed queries:', { cardQueries, keywordQueries, tagQueries, sizeQueries });

  const searchResult = await performSearch(
    cardQueries,
    keywordQueries,
    tagQueries,
    sizeQueries,
    order,
    ascending,
    user,
    lastKey,
  );

  console.log('[Search] Result:', { cubesCount: searchResult.cubes.length, error: searchResult.error });

  return {
    cubes: searchResult.cubes,
    lastKey: searchResult.lastKey,
    parsedQuery: getHumanReadableQuery(cardQueries, keywordQueries, tagQueries, sizeQueries),
    error: searchResult.error,
  };
};

export const getHandler = async (req: Request, res: Response) => {
  const ascending = req.query.ascending || 'false';
  const order = (req.query.order as SortOrder) || 'pop';
  const query = (req.query.q as string) || '';

  const result = await searchCubes(query, order, null, ascending === 'true', req.user);

  if (result.error) {
    req.flash('danger', result.error);
  }

  return render(req, res, 'SearchPage', {
    cubes: result.cubes,
    lastKey: result.lastKey,
    parsedQuery: result.parsedQuery,
    query: query,
  });
};

export const getmoresearchitemsHandler = async (req: Request, res: Response) => {
  const { lastKey, query, order, ascending } = req.body;

  const result = await searchCubes(query, order, lastKey, ascending, req.user);

  return res.status(200).send({
    success: 'true',
    cubes: result.cubes,
    lastKey: result.lastKey,
    parsedQuery: result.parsedQuery,
    error: result.error,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [getHandler],
  },
  {
    path: '/getmoresearchitems',
    method: 'post',
    handler: [getmoresearchitemsHandler],
  },
];
