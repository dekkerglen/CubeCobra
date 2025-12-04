import { PrintingPreference } from '@utils/datatypes/Card';
import Cube from 'dynamo/models/cube';
import CubeHash from 'dynamo/models/cubeHash';
import { cardFromId, getMostReasonable, getReasonableCardByOracle } from 'serverutils/carddb';
import { isCubeListed } from 'serverutils/cubefn';
import { render } from 'serverutils/render';
import { csrfProtection } from 'src/router/middleware';

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

const getHumanReadableQuery = (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  tagQueries: TagQuery[],
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

const searchWithKeywordQuery = async (
  keywordQueries: KeywordQuery[],
  order: SortOrder,
  lastKey: any,
  ascending: boolean,
  user: any,
): Promise<SearchResult> => {
  let result;
  const hashRows: any[] = [];

  do {
    result = await CubeHash.query(
      keywordQueries.length > 0 && keywordQueries[0]
        ? `keywords:${keywordQueries[0].value.toLowerCase()}`
        : `featured:false`,
      ascending,
      lastKey,
      order,
      128,
    );

    hashRows.push(
      ...result.items.filter((hash: any) => {
        for (const query of keywordQueries) {
          if (!hash.name.toLowerCase().includes(query.value.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    );

    lastKey = result.lastKey;
  } while (hashRows.length < 36 && result.lastKey);

  const items = (result.items.length > 0 ? await Cube.batchGet(hashRows.map((hash) => hash.cube)) : []).filter(
    (cube: any) => isCubeListed(cube, user),
  );

  // make sure items is in same order as hashRows
  const cubes = hashRows
    .flat()
    .map((hash) => items.find((cube: any) => cube.id === hash.cube))
    .filter((cube) => cube);

  return {
    cubes: cubes,
    lastKey: result.lastKey,
  };
};

const searchWithCardQueries = async (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  order: SortOrder,
  lastKey: any,
  ascending: boolean,
  user: any,
): Promise<SearchResult> => {
  if (cardQueries.length > 1) {
    return {
      error: 'Can only search for one card at a time',
      cubes: [],
      lastKey: null,
    };
  }

  let result;
  let iterations = 0;
  const hashRows: any[] = [];

  do {
    result = await CubeHash.query(`oracle:${cardQueries[0]!.value}`, ascending, lastKey, order, 128);
    iterations += 1;
    hashRows.push(
      ...result.items.filter((hash: any) => {
        for (const query of keywordQueries) {
          if (!hash.name.toLowerCase().includes(query.value.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    );

    lastKey = result.lastKey;
  } while (hashRows.length < 36 && result.lastKey && iterations < 10);

  const items = (result.items.length > 0 ? await Cube.batchGet(hashRows.map((hash) => hash.cube)) : []).filter(
    (cube: any) => isCubeListed(cube, user),
  );

  // make sure items is in same order as hashRows
  const cubes = hashRows
    .flat()
    .map((hash) => items.find((cube: any) => cube.id === hash.cube))
    .filter((cube) => cube);

  return {
    cubes: cubes,
    lastKey: result.lastKey,
  };
};

const searchWithTagQueries = async (
  tagQueries: TagQuery[],
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  order: SortOrder,
  lastKey: any,
  ascending: boolean,
  user: any,
): Promise<SearchResult> => {
  let result;
  const hashRows: any[] = [];

  do {
    result = await CubeHash.query(`tag:${tagQueries[0]!.value}`, ascending, lastKey, order, 128);

    hashRows.push(
      ...result.items.filter((hash: any) => {
        for (const query of keywordQueries) {
          if (!hash.name.toLowerCase().includes(query.value.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    );

    lastKey = result.lastKey;
  } while (hashRows.length < 36 && result.lastKey);

  const items = (result.items.length > 0 ? await Cube.batchGet(hashRows.map((hash) => hash.cube)) : []).filter(
    (cube: any) => isCubeListed(cube, user),
  );

  // make sure items is in same order as hashRows
  const cubes = hashRows
    .flat()
    .map((hash) => items.find((cube: any) => cube.id === hash.cube))
    .filter((cube) => cube)
    .filter((cube: any) => {
      const lowerCaseTags = (cube.tags || []).map((tag: string) => tag.toLowerCase());
      for (const query of tagQueries) {
        if (!lowerCaseTags.includes(query.value.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

  if (cardQueries.length === 0) {
    return {
      cubes: cubes,
      lastKey: result.lastKey,
    };
  }

  const cubeCards = await Promise.all(cubes.map((cube: any) => Cube.getCards(cube.id)));

  const cubeWithCardFilter = cubes.filter((_cube: any, index: number) => {
    const cards = cubeCards[index];
    const oracleIds = cards.mainboard.map((card: any) => cardFromId(card.cardID).oracle_id);

    for (const query of cardQueries) {
      if (!oracleIds.some((o: string) => o === query.value)) {
        return false;
      }
    }

    return true;
  });

  return {
    cubes: cubeWithCardFilter,
    lastKey: result.lastKey,
  };
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

  const cardQueries = getCardQueries(tokens, user?.defaultPrinting);
  const keywordQueries = getKeywordQueries(tokens);
  const tagQueries = getTagQueries(tokens);

  if (tagQueries.length > 0) {
    const searchResult = await searchWithTagQueries(
      tagQueries,
      cardQueries,
      keywordQueries,
      order,
      lastKey,
      ascending,
      user,
    );

    return {
      cubes: searchResult.cubes,
      lastKey: searchResult.lastKey,
      parsedQuery: getHumanReadableQuery(cardQueries, keywordQueries, tagQueries),
      error: searchResult.error,
    };
  }

  if (cardQueries.length > 0) {
    const searchResult = await searchWithCardQueries(cardQueries, keywordQueries, order, lastKey, ascending, user);

    return {
      cubes: searchResult.cubes,
      lastKey: searchResult.lastKey,
      parsedQuery: getHumanReadableQuery(cardQueries, keywordQueries, tagQueries),
      error: searchResult.error,
    };
  }

  const searchResult = await searchWithKeywordQuery(keywordQueries, order, lastKey, ascending, user);

  return {
    cubes: searchResult.cubes,
    lastKey: searchResult.lastKey,
    parsedQuery: getHumanReadableQuery(cardQueries, keywordQueries, tagQueries),
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
    handler: [csrfProtection, getHandler],
  },
  {
    path: '/getmoresearchitems',
    method: 'post',
    handler: [csrfProtection, getmoresearchitemsHandler],
  },
];
