import { createTypeGuard } from '@utils/typeGuards';
import { cardHistoryDao } from 'dynamo/daos';

import { Request, Response } from '../../../types/express';

const zoomValues = ['month', 'year', 'all'] as const;
const periodValues = ['day', 'week', 'month'] as const;

type Zoom = (typeof zoomValues)[number];
type Period = (typeof periodValues)[number];

const isValidZoom = createTypeGuard<Zoom>(zoomValues);
const isValidPeriod = createTypeGuard<Period>(periodValues);

export const getZoomValue = (zoom: Zoom, period: Period): number => {
  if (!isValidZoom(zoom) || !isValidPeriod(period)) {
    return 0;
  }

  // 'all' returns 0 which means fetch all records without limit
  if (zoom === 'all') {
    return 0;
  }

  const zoomMap: Record<'month' | 'year', Record<Period, number>> = {
    month: {
      day: 30,
      week: 4,
      month: 2,
    },
    year: {
      day: 365,
      week: 52,
      month: 12,
    },
  };

  return zoomMap[zoom][period];
};

export const getCardHistoryHandler = async (req: Request, res: Response) => {
  try {
    const { id, zoom, period, offset = 0 } = req.body;

    let zoomValue = getZoomValue(zoom, period);

    // For 'all' zoom, fetch everything; otherwise respect the zoom value
    if (zoom === 'all') {
      zoomValue = 10000; // Large number to get all history
    } else if (offset > 0) {
      // When paginating, add offset to zoom value
      zoomValue += offset;
    }

    const history = await cardHistoryDao.queryByOracleAndType(id, period, zoomValue);
    let items = (history?.items ?? []).reverse();

    // If offset is provided and not 'all', slice the appropriate range
    // After reversing, oldest items are first. We want the oldest baseZoom items.
    if (offset > 0 && zoom !== 'all') {
      const baseZoom = getZoomValue(zoom, period);
      items = items.slice(0, baseZoom);
    }

    return res.status(200).send({
      success: 'true',
      data: items,
      hasMore: history?.items?.length === zoomValue,
    });
  } catch {
    return res.status(500).send({
      success: 'false',
      data: [],
      hasMore: false,
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [getCardHistoryHandler],
  },
];
