import CardHistory from 'dynamo/models/cardhistory';
import { csrfProtection } from 'routes/middleware';
import { Request, Response } from '../../../types/express';
import { createTypeGuard } from '@utils/typeGuards';

const zoomValues = ['month', 'year'] as const;
const periodValues = ['day', 'week', 'month'] as const;

type Zoom = (typeof zoomValues)[number];
type Period = (typeof periodValues)[number];

const isValidZoom = createTypeGuard<Zoom>(zoomValues);
const isValidPeriod = createTypeGuard<Period>(periodValues);

export const getZoomValue = (zoom: Zoom, period: Period): number => {
  if (!isValidZoom(zoom) || !isValidPeriod(period)) {
    return 0;
  }

  const zoomMap: Record<Zoom, Record<Period, number>> = {
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
    const { id, zoom, period } = req.body;

    const zoomValue = getZoomValue(zoom, period);

    const history = await CardHistory.getByOracleAndType(id, period, zoomValue);

    return res.status(200).send({
      success: 'true',
      data: (history?.items ?? []).reverse(),
    });
  } catch {
    return res.status(500).send({
      success: 'false',
      data: [],
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [csrfProtection, getCardHistoryHandler],
  },
];
