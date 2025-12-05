declare module 'express-messages' {
  import { Request, Response } from 'express';

  function expressMessages(req: Request, res: Response): () => string;

  export = expressMessages;
}
