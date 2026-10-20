import { Request, Response } from '../types/express';

export const createHealthcheckHandler =
  (isReady: () => boolean) =>
  (_req: Request, res: Response): void => {
    res.set({ 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' });
    if (isReady()) {
      res.status(200).send('OK');
    } else {
      res.status(503).send('Starting');
    }
  };
