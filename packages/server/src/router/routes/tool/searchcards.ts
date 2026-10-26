import { cardElo, detailsToCard } from '@utils/cardutil';
import { toDistinct } from '@utils/cardSearchOptions';
import { CardDetails } from '@utils/datatypes/Card';
import { makeFilter, MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import { OrderedSortsType } from '@utils/sorting/Sort';
import { SortDirectionsType } from '@utils/sorting/sortContext';
import { expensiveGetLimiter } from 'serverutils/rateLimiters';
import { render } from 'serverutils/render';
import { searchAllCards } from 'serverutils/tools';

import { Request, Response } from '../../../types/express';

export const getSearchCardsHandler = async (req: Request, res: Response) =>
  render(
    req,
    res,
    'CardSearchPage',
    {},
    {
      title: 'Search Cards',
    },
  );

// Header order must match the columns written by cardToCsvRow below.
const CSV_HEADER = 'Name,CMC,Type,Color,Set,Collector Number,Rarity,Elo,Total Picks,Cube Count';

// Wrap a value in quotes and escape embedded quotes per RFC 4180.
const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const cardToCsvRow = (card: CardDetails): string => {
  // Mirror the values shown in the search table so the export matches the page.
  const elo = card.elo === null || card.elo === undefined ? '' : Math.round(cardElo(detailsToCard(card))).toString();
  const pickCount = card.pickCount === null || card.pickCount === undefined ? '' : Number(card.pickCount).toString();
  const cubeCount = card.cubeCount === null || card.cubeCount === undefined ? '' : Number(card.cubeCount).toString();

  return [
    quote(card.name ?? ''),
    (card.cmc ?? 0).toString(),
    quote((card.type ?? '').replace('—', '-')),
    (card.colors ?? []).join(''),
    quote(card.set ?? ''),
    quote(card.collector_number ?? ''),
    card.rarity ?? '',
    elo,
    pickCount,
    cubeCount,
  ].join(',');
};

export const csvHandler = async (req: Request, res: Response) => {
  try {
    const filterText = req.query.f ?? '';
    if (typeof filterText !== 'string' || filterText.length > MAX_SEARCH_FILTER_LENGTH) {
      res.status(400).send('Invalid filter');
      return;
    }

    const { err, filter } = makeFilter(filterText);
    if (err || !filter) {
      res.status(400).send('Invalid filter');
      return;
    }

    const includeExtras = req.query.ie === '1' || req.query.ie === 'true';
    const cards = searchAllCards(
      filter,
      req.query.s as OrderedSortsType,
      req.query.d as SortDirectionsType,
      toDistinct(req.query.di as string | undefined),
      req?.user?.defaultPrinting,
      includeExtras,
    );

    res.setHeader('Content-disposition', 'attachment; filename=cardsearch.csv');
    res.setHeader('Content-type', 'text/csv');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);
    for (const card of cards) {
      res.write(`${cardToCsvRow(card)}\r\n`);
    }
    return res.end();
  } catch (error) {
    const e = error as Error;
    req.logger.error(e.message, e.stack);
    res.status(500).send('Error generating CSV');
    return;
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getSearchCardsHandler],
  },
  {
    method: 'get',
    path: '/csv',
    // Exports every matching card, so it is far heavier than a page of results.
    handler: [expensiveGetLimiter(60_000, 10), csvHandler],
  },
];
