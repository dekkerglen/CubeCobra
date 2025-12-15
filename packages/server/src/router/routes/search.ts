import { PrintingPreference } from '@utils/datatypes/Card';
import { cubeDao } from 'dynamo/daos';
import { SortOrder as DaoSortOrder } from 'dynamo/dao/CubeDynamoDao';
import { getMostReasonable, getReasonableCardByOracle } from 'serverutils/carddb';
import { isCubeListed } from 'serverutils/cubefn';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

type SortOrder = 'pop' | 'alpha' | 'cards' | 'date';

interface CardQuery {
  type: 'card' | 'oracle';
  value: string;
  originalToken: string;
}

interface KeywordQuery {
  type: 'keywords';
  value: string;
  originalToken: string;
}

interface TagQuery {
  type: 'tag';
  value: string;
  originalToken: string;
}

interface CategoryQuery {
  type: 'category';
  value: string;
  originalToken: string;
}

interface SizeQuery {
  type: 'size';
  operator: 'eq' | 'gt' | 'lt';
  value: number;
  originalToken: string;
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
      queries.push({ type: 'oracle', value: split[1], originalToken: token });
    }

    if (split[0] === 'card' && split[1]) {
      const card = getMostReasonable(split[1], printing);

      if (card) {
        queries.push({ type: 'card', value: card.oracle_id, originalToken: token });
      } else {
        queries.push({ type: 'card', value: '', originalToken: token });
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
      queries.push({ type: 'keywords', value: split[1], originalToken: token });
    }

    // Only treat as keyword if it doesn't have a colon and doesn't match size/cards pattern
    if (split.length === 1 && split[0] && split[0].length > 0) {
      // Check if it matches size/cards pattern (e.g., "size>250", "cards=399")
      const sizeMatch = token.match(/^(?:size|cards)([><=])\d+$/i);
      if (!sizeMatch) {
        queries.push({ type: 'keywords', value: split[0], originalToken: token });
      }
    }
  }

  return queries;
};

const getTagQueries = (tokens: string[]): TagQuery[] => {
  const queries: TagQuery[] = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'tag' && split[1]) {
      queries.push({ type: 'tag', value: split[1], originalToken: token });
    }
  }

  return queries;
};

const getCategoryQueries = (tokens: string[]): CategoryQuery[] => {
  const queries: CategoryQuery[] = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'category' && split[1]) {
      queries.push({ type: 'category', value: split[1], originalToken: token });
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

      queries.push({ type: 'size', operator: op, value, originalToken: token });
    }
  }

  return queries;
};

const getHumanReadableQuery = (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  tagQueries: TagQuery[],
  categoryQueries: CategoryQuery[],
  sizeQueries: SizeQuery[],
  ignoredTokens: string[],
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

  for (const query of categoryQueries) {
    result.push(`Cube category "${query.value}"`);
  }

  for (const query of sizeQueries) {
    const opText = query.operator === 'eq' ? '=' : query.operator === 'gt' ? '>' : '<';
    result.push(`Cube size ${opText} ${query.value} cards`);
  }

  for (const token of ignoredTokens) {
    result.push(`Ignored unrecognized query: "${token}"`);
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
    case 'date':
      return 'date';
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
  categoryQueries: CategoryQuery[],
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

  // Add category hashes for category queries
  for (const query of categoryQueries) {
    hashes.push(`category:${query.value.toLowerCase()}`);
  }

  // Add keyword hashes for keyword queries
  // Note: For multiple keywords, we'll use the first one as primary hash
  // and filter the rest in memory
  // Normalize keywords the same way cube names are normalized when storing hashes
  if (keywordQueries.length > 0 && keywordQueries[0]) {
    const normalizedKeyword = keywordQueries[0].value
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();
    hashes.push(`keywords:${normalizedKeyword}`);
  }

  // If no hashes, use the global 'cube:all' hash to query all public cubes
  // This allows us to use the efficient hash-based sorting
  if (hashes.length === 0) {
    hashes.push('cube:all');
  }

  return hashes;
};

const performSearch = async (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  tagQueries: TagQuery[],
  categoryQueries: CategoryQuery[],
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

  if (categoryQueries.length > 10) {
    return {
      error: 'Can only search for up to 10 categories at a time',
      cubes: [],
      lastKey: null,
    };
  }

  const hashes = buildHashesForQuery(cardQueries, keywordQueries, tagQueries, categoryQueries);

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

    if (hashes.length === 1) {
      console.log('[Search] Querying by single hash', { hash: hashes[0], cardCountFilter, lastKey });
      // Determine which query method to use based on hash prefix
      const hash = hashes[0] || '';
      let result;

      if (hash.startsWith('oracle:')) {
        const oracleId = hash.substring('oracle:'.length);
        console.log('[Search] Using queryByOracleId', { oracleId });
        result = await cubeDao.queryByOracleId(oracleId, mapSortOrder(order), ascending, lastKey || undefined, 36);
        console.log(`[Search] queryByOracleId returned ${result.items.length} cubes`);
      } else if (hash.startsWith('tag:')) {
        const tag = hash.substring('tag:'.length);
        console.log('[Search] Using queryByTag', { tag });
        result = await cubeDao.queryByTag(tag, mapSortOrder(order), ascending, lastKey || undefined, 36);
        console.log(`[Search] queryByTag returned ${result.items.length} cubes`);
      } else if (hash.startsWith('keywords:')) {
        const keywords = hash.substring('keywords:'.length);
        console.log('[Search] Using queryByKeyword', { keywords });
        result = await cubeDao.queryByKeyword(keywords, mapSortOrder(order), ascending, lastKey || undefined, 36);
        console.log(`[Search] queryByKeyword returned ${result.items.length} cubes`);
      } else if (hash.startsWith('category:')) {
        const category = hash.substring('category:'.length);
        console.log('[Search] Using queryByCategory', { category });
        result = await cubeDao.queryByCategory(category, mapSortOrder(order), ascending, lastKey || undefined, 36);
        console.log(`[Search] queryByCategory returned ${result.items.length} cubes`);
      } else if (hash === 'featured:true') {
        console.log('[Search] Using queryByFeatured');
        result = await cubeDao.queryByFeatured(mapSortOrder(order), ascending, lastKey || undefined, 36);
        console.log(`[Search] queryByFeatured returned ${result.items.length} cubes`);
      } else if (hash === 'cube:all') {
        console.log('[Search] Using queryAllCubes to query all cubes');
        result = await cubeDao.queryAllCubes(mapSortOrder(order), ascending, lastKey || undefined, 36);
        console.log(`[Search] queryAllCubes returned ${result.items.length} cubes`);
      } else {
        console.log('[Search] Unknown hash type, skipping', { hash });
        // Unknown hash type - return empty results
        result = { items: [], lastKey: undefined };
      }

      cubes = result.items;
      resultLastKey = result.lastKey;
    } else {
      console.log('[Search] Querying by multiple hashes', { hashes, cardCountFilter });
      // Use queryByMultipleHashes from cubeDao (which efficiently handles cardCountFilter natively)
      cubes = await cubeDao.queryByMultipleHashes(hashes, mapSortOrder(order), ascending, cardCountFilter);
      // Note: queryByMultipleHashes doesn't support pagination yet
      resultLastKey = null;
    }

    // Filter by listing visibility
    const visibleCubes = cubes.filter((cube: any) => isCubeListed(cube, user));
    console.log(`[Search] After visibility filter: ${visibleCubes.length} cubes`);

    return {
      cubes: visibleCubes,
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
  const categoryQueries = getCategoryQueries(tokens);
  const sizeQueries = getSizeQueries(tokens);

  // Track which tokens were actually used in queries
  const usedTokens = new Set<string>();
  cardQueries.forEach((q) => usedTokens.add(q.originalToken.toLowerCase()));
  keywordQueries.forEach((q) => usedTokens.add(q.originalToken.toLowerCase()));
  tagQueries.forEach((q) => usedTokens.add(q.originalToken.toLowerCase()));
  categoryQueries.forEach((q) => usedTokens.add(q.originalToken.toLowerCase()));
  sizeQueries.forEach((q) => usedTokens.add(q.originalToken.toLowerCase()));

  // Find tokens that weren't used in any query
  const ignoredTokens = tokens.filter((token) => !usedTokens.has(token.toLowerCase()));

  console.log('[Search] Parsed queries:', {
    cardQueries,
    keywordQueries,
    tagQueries,
    categoryQueries,
    sizeQueries,
    ignoredTokens,
  });

  const searchResult = await performSearch(
    cardQueries,
    keywordQueries,
    tagQueries,
    categoryQueries,
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
    parsedQuery: getHumanReadableQuery(
      cardQueries,
      keywordQueries,
      tagQueries,
      categoryQueries,
      sizeQueries,
      ignoredTokens,
    ),
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
