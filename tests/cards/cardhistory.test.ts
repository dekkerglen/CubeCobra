import CardHistory from '../../src/dynamo/models/cardhistory';
import { getCardHistoryHandler, getZoomValue } from '../../src/router/routes/tool/cardHistory';
import { Response } from '../../src/types/express';
import { expectRegisteredRoutes } from '../test-utils/route';
import { call } from '../test-utils/transport';

jest.mock('../../src/dynamo/models/cardhistory', () => ({
  getByOracleAndType: jest.fn(),
}));

describe('getZoomValue', () => {
  const zoomValues = ['month', 'year'] as const;
  const periodValues = ['day', 'week', 'month'] as const;

  const expectedValues: Record<(typeof zoomValues)[number], Record<(typeof periodValues)[number], number>> = {
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

  it('should return the correct value for all valid zoom and period combinations', async () => {
    zoomValues.forEach((zoom) => {
      periodValues.forEach((period) => {
        const result = getZoomValue(zoom, period);
        const expected = expectedValues[zoom][period];
        expect(result).toBe(expected);
      });
    });
  });

  it('should return 0 for invalid zoom values', async () => {
    const invalidZooms = ['invalid', '', 'day', 'week'];
    periodValues.forEach((period) => {
      invalidZooms.forEach((zoom) => {
        const result = getZoomValue(zoom, period);
        expect(result).toBe(0);
      });
    });
  });

  it('should return 0 for invalid period values', async () => {
    const invalidPeriods = ['invalid', '', 'hour', 'year'];
    zoomValues.forEach((zoom) => {
      invalidPeriods.forEach((period) => {
        const result = getZoomValue(zoom, period);
        expect(result).toBe(0);
      });
    });
  });

  it('should return 0 for completely invalid zoom and period combinations', async () => {
    const invalidZooms = ['invalid', '', 'day', 'week'];
    const invalidPeriods = ['invalid', '', 'hour', 'year'];

    invalidZooms.forEach((zoom) => {
      invalidPeriods.forEach((period) => {
        const result = getZoomValue(zoom, period);
        expect(result).toBe(0);
      });
    });
  });
});

describe('Cards History', () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return card history', async () => {
    (CardHistory.getByOracleAndType as jest.Mock).mockResolvedValue({
      items: [
        {
          OTComp: 'otcomp',
          oracle: 'oracle',
          date: 0,
          elo: 0,
          picks: 1,
        },
      ],
    });

    await call(getCardHistoryHandler)
      .withBody({
        id: 'id',
        zoom: 'month',
        period: 'day',
      })
      .withResponse(res)
      .send();

    expect(CardHistory.getByOracleAndType).toHaveBeenCalledWith('id', 'day', 30);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      data: [
        {
          OTComp: 'otcomp',
          oracle: 'oracle',
          date: 0,
          elo: 0,
          picks: 1,
        },
      ],
    });
  });

  it('should handle errors gracefully', async () => {
    (CardHistory.getByOracleAndType as jest.Mock).mockRejectedValue(new Error('something went wrong'));

    await call(getCardHistoryHandler)
      .withBody({
        id: 'id',
        zoom: 'month',
        period: 'day',
      })
      .withResponse(res)
      .send();

    expect(CardHistory.getByOracleAndType).toHaveBeenCalledWith('id', 'day', 30);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      data: [],
    });
  });
});

describe('Card History Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        path: '/tool/cardhistory/',
        method: 'post',
      },
    ]);
  });
});
