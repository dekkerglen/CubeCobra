import CardPackage from '@utils/datatypes/CardPackage';
import { PrintingPreference } from '@utils/datatypes/Card';
import { UserRoles } from '@utils/datatypes/User';
import { packageDao, userDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth, ensureRole } from 'router/middleware';
import { cardFromId, getMostReasonable } from 'serverutils/carddb';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

type SortOrder = 'votes' | 'date';

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

interface UserQuery {
  type: 'user';
  value: string;
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
        console.log(`[getCardQueries] Found card: ${card.name}, oracle_id: ${card.oracle_id}`);
        queries.push({ type: 'card', value: card.oracle_id, originalToken: token });
      } else {
        console.log(`[getCardQueries] Card not found: ${split[1]}`);
        queries.push({ type: 'card', value: '', originalToken: token });
      }
    }
  }

  return queries;
};

const getUserQueries = (tokens: string[]): UserQuery[] => {
  const queries: UserQuery[] = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'user' && split[1]) {
      queries.push({ type: 'user', value: split[1], originalToken: token });
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

    // Only treat as keyword if it doesn't have a colon
    if (split.length === 1 && split[0] && split[0].length > 0) {
      queries.push({ type: 'keywords', value: split[0], originalToken: token });
    }
  }

  return queries;
};

const buildHashesForQuery = (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  userQueries: UserQuery[],
): Array<{ type: string; value: string }> => {
  const hashes: Array<{ type: string; value: string }> = [];

  // Add oracle hashes for card queries
  for (const query of cardQueries) {
    if (query.value && query.value !== '') {
      hashes.push({ type: 'oracle', value: query.value });
    }
  }

  // Add user hash for user queries
  for (const query of userQueries) {
    if (query.value && query.value !== '') {
      hashes.push({ type: 'user', value: query.value });
    }
  }

  // Add keyword hashes for keyword queries
  // For multiple keywords, we'll use the first one as primary hash
  // and filter the rest in memory
  if (keywordQueries.length > 0 && keywordQueries[0]) {
    const normalizedKeyword = keywordQueries[0].value
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();
    hashes.push({ type: 'keywords', value: normalizedKeyword });
  }

  // If no hashes, use the global 'package:all' hash to query all packages
  if (hashes.length === 0) {
    hashes.push({ type: 'package', value: 'all' });
  }

  return hashes;
};

const performSearch = async (
  cardQueries: CardQuery[],
  keywordQueries: KeywordQuery[],
  userQueries: UserQuery[],
  order: SortOrder,
  ascending: boolean,
  lastKey?: any,
): Promise<{
  packages: CardPackage[];
  lastKey: any;
  error?: string;
}> => {
  // Check for unsupported combinations
  if (cardQueries.length > 10) {
    return {
      error: 'Can only search for up to 10 cards at a time',
      packages: [],
      lastKey: null,
    };
  }

  if (userQueries.length > 1) {
    return {
      error: 'Can only search for one user at a time',
      packages: [],
      lastKey: null,
    };
  }

  // Handle user query separately (uses different index)
  if (userQueries.length === 1) {
    try {
      // Resolve username to user ID
      const username = userQueries[0]!.value.toLowerCase();
      const user = await userDao.getByUsername(username);

      if (!user) {
        return {
          error: `User '${username}' not found`,
          packages: [],
          lastKey: null,
        };
      }

      const result = await packageDao.queryByOwner(user.id, order, ascending, lastKey || undefined, 36);
      return {
        packages: result.items || [],
        lastKey: result.lastKey,
      };
    } catch (error) {
      console.error('[performSearch] Error querying by user:', error);
      return {
        error: 'An error occurred while searching packages by user',
        packages: [],
        lastKey: null,
      };
    }
  }

  const hashes = buildHashesForQuery(cardQueries, keywordQueries, userQueries);

  if (hashes.length > 10) {
    return {
      error: 'Search query is too complex (max 10 combined card/keyword filters)',
      packages: [],
      lastKey: null,
    };
  }

  try {
    let packages: CardPackage[];
    let resultLastKey: any = null;

    if (hashes.length === 1) {
      // Determine which query method to use based on hash type
      const hash = hashes[0]!;
      let result;

      if (hash.type === 'oracle') {
        result = await packageDao.queryByOracleId(hash.value, order, ascending, lastKey || undefined, 36);
      } else if (hash.type === 'keywords') {
        result = await packageDao.queryByKeyword(hash.value, order, ascending, lastKey || undefined, 36);
      } else if (hash.type === 'package' && hash.value === 'all') {
        result = await packageDao.queryAllPackages(order, ascending, lastKey || undefined, 36);
      } else {
        result = await packageDao.queryByHashCriteria(
          hash.type,
          hash.value,
          order,
          ascending,
          lastKey || undefined,
          36,
        );
      }

      packages = result.items || [];
      resultLastKey = result.lastKey;
    } else {
      // Multiple hashes - use queryByMultipleHashes
      const result = await packageDao.queryByMultipleHashes(hashes, order, ascending, lastKey || undefined, 36);
      packages = result.items || [];
      resultLastKey = result.lastKey;
    }

    return {
      packages,
      lastKey: resultLastKey,
    };
  } catch (error) {
    console.error('[performSearch] Error performing search:', error);
    return {
      error: 'An error occurred while searching packages',
      packages: [],
      lastKey: null,
    };
  }
};

export const getIndexHandler = async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const sort = (req.query.s as string) || 'votes';
    const ascending = req.query.a === 'true';

    const tokens = tokenize(query);
    const cardQueries = getCardQueries(tokens);
    const keywordQueries = getKeywordQueries(tokens);
    const userQueries = getUserQueries(tokens);

    const result = await performSearch(
      cardQueries,
      keywordQueries,
      userQueries,
      sort as SortOrder,
      ascending,
      undefined,
    );

    if (result.error) {
      req.flash('danger', result.error);
    }

    // Build parsed query display
    const parsedQuery: string[] = [];
    const recognizedTokens = new Set<string>();

    for (const cardQuery of cardQueries) {
      if (cardQuery.type === 'oracle') {
        parsedQuery.push(`contains card with oracle ID: ${cardQuery.value}`);
      } else {
        // card type - extract card name from token
        const cardName = cardQuery.originalToken.replace(/^card:"?/i, '').replace(/"?$/, '');
        parsedQuery.push(`contains ${cardName}`);
      }
      recognizedTokens.add(cardQuery.originalToken);
    }
    for (const userQuery of userQueries) {
      parsedQuery.push(`owned by ${userQuery.value}`);
      recognizedTokens.add(userQuery.originalToken);
    }
    for (const keywordQuery of keywordQueries) {
      parsedQuery.push(`keyword: ${keywordQuery.value}`);
      recognizedTokens.add(keywordQuery.originalToken);
    }

    // Add unrecognized tokens
    for (const token of tokens) {
      if (!recognizedTokens.has(token)) {
        parsedQuery.push(`[ignored: ${token}]`);
      }
    }

    return render(req, res, 'PackagesPage', {
      items: result.packages,
      lastKey: result.lastKey,
      parsedQuery,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const getMoreHandler = async (req: Request, res: Response) => {
  try {
    const query = req.body.query || '';
    const sort = req.body.sort || 'votes';
    const ascending = req.body.ascending === 'true';
    const lastKey = req.body.lastKey;

    const tokens = tokenize(query);
    const cardQueries = getCardQueries(tokens);
    const keywordQueries = getKeywordQueries(tokens);
    const userQueries = getUserQueries(tokens);

    const result = await performSearch(cardQueries, keywordQueries, userQueries, sort as SortOrder, ascending, lastKey);

    // Build parsed query display
    const parsedQuery: string[] = [];
    const recognizedTokens = new Set<string>();

    for (const cardQuery of cardQueries) {
      if (cardQuery.type === 'oracle') {
        parsedQuery.push(`contains card with oracle ID: ${cardQuery.value}`);
      } else {
        // card type - extract card name from token
        const cardName = cardQuery.originalToken.replace(/^card:"?/i, '').replace(/"?$/, '');
        parsedQuery.push(`contains ${cardName}`);
      }
      recognizedTokens.add(cardQuery.originalToken);
    }
    for (const userQuery of userQueries) {
      parsedQuery.push(`owned by ${userQuery.value}`);
      recognizedTokens.add(userQuery.originalToken);
    }
    for (const keywordQuery of keywordQueries) {
      parsedQuery.push(`keyword: ${keywordQuery.value}`);
      recognizedTokens.add(keywordQuery.originalToken);
    }

    // Add unrecognized tokens
    for (const token of tokens) {
      if (!recognizedTokens.has(token)) {
        parsedQuery.push(`[ignored: ${token}]`);
      }
    }

    return res.status(200).send({
      packages: result.packages,
      lastKey: result.lastKey,
      error: result.error,
      parsedQuery,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const submitHandler = async (req: Request, res: Response) => {
  try {
    const { cards, packageName } = req.body;

    if (typeof packageName !== 'string' || packageName.length === 0) {
      return res.status(400).send({
        success: 'false',
        message: 'Please provide a name for your new package.',
      });
    }

    if (!Array.isArray(cards) || cards.length < 2) {
      return res.status(400).send({
        success: 'false',
        message: 'Please provide more than one card for your package.',
      });
    }

    if (cards.length > 100) {
      return res.status(400).send({
        success: 'false',
        message: 'Packages cannot be more than 100 cards.',
      });
    }

    if (!req.user) {
      return res.status(400).send({
        success: 'false',
        message: 'You must be logged in to create a package.',
      });
    }

    const poster = await userDao.getById(req.user.id);
    if (!poster) {
      return res.status(400).send({
        success: 'false',
        message: 'You must be logged in to create a package.',
      });
    }

    const keywords = packageName
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(' ');

    for (const card of cards) {
      keywords.push(
        ...cardFromId(card)
          .name_lower.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
          .split(' '),
      );
    }

    // make distinct
    const distinctKeywords = keywords.filter((value, index, self) => self.indexOf(value) === index);

    await packageDao.createPackage({
      title: packageName,
      date: Date.now(),
      owner: poster.id,
      cards,
      voters: [],
      keywords: distinctKeywords,
    });

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const upvoteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      return res.status(404).send({
        success: 'false',
        message: 'Package not found.',
      });
    }

    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'You must be logged in to upvote.',
      });
    }

    pack.voters = [...new Set([...pack.voters, req.user.id])];
    await packageDao.update(pack);

    return res.status(200).send({
      success: 'true',
      voters: pack.voters,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const downvoteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      return res.status(404).send({
        success: 'false',
        message: 'Package not found.',
      });
    }

    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'You must be logged in to downvote.',
      });
    }

    pack.voters = pack.voters.filter((voter: string) => voter !== req.user!.id);
    await packageDao.update(pack);

    return res.status(200).send({
      success: 'true',
      voters: pack.voters,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const removeHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Package ID is required.',
      });
    }

    const pack = await packageDao.getById(req.params.id!);
    if (pack) {
      await packageDao.delete(pack);
    }

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const getPackageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid package ID');
      return redirect(req, res, '/packages');
    }

    const pack = await packageDao.getById(req.params.id!);

    if (!pack) {
      req.flash('danger', `Package not found`);
      return redirect(req, res, '/packages');
    }

    return render(req, res, 'PackagePage', {
      pack,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [csrfProtection, getIndexHandler],
  },
  {
    path: '/getmore',
    method: 'post',
    handler: [csrfProtection, getMoreHandler],
  },
  {
    path: '/submit',
    method: 'post',
    handler: [ensureAuth, csrfProtection, submitHandler],
  },
  {
    path: '/upvote/:id',
    method: 'get',
    handler: [ensureAuth, csrfProtection, upvoteHandler],
  },
  {
    path: '/downvote/:id',
    method: 'get',
    handler: [ensureAuth, csrfProtection, downvoteHandler],
  },
  {
    path: '/remove/:id',
    method: 'get',
    handler: [ensureRole(UserRoles.ADMIN), csrfProtection, removeHandler],
  },
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, getPackageHandler],
  },
];
