import type UserType from '@utils/datatypes/User';
import express from 'express';

// Extend Error interface to include status property
export interface CustomError extends Error {
  status?: number;
}

// Override the user type in the global Express namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends UserType {}
    interface Request {
      user?: User;
      uuid: string;
      // Raw request body bytes, captured by the body-parser `verify` hook for routes
      // (e.g. the Patreon webhook) that must validate an HMAC signature over the exact
      // bytes the sender signed. Only populated for those routes; undefined otherwise.
      rawBody?: Buffer;
      logger: {
        error: (...args: any[]) => void;
        info: (...args: any[]) => void;
      };
      // NOTE: `flash` is intentionally NOT declared here — `@types/connect-flash` already
      // augments Express.Request with an identical signature. TS7's checker (unlike TS<=6)
      // treats a second identical declaration as a duplicate identifier (TS2300), so we rely
      // on the @types package for it. The exported `Request` interface below still lists it.
      validated?: boolean;
      isAuthenticated(): boolean;
      csrfToken(): string;
    }
  }
}

// Export types for use in other files
export interface Request extends Omit<express.Request, 'isAuthenticated' | 'flash'> {
  user?: Express.User;
  uuid: string;
  rawBody?: Buffer;
  logger: {
    error: (...args: any[]) => void;
    info: (...args: any[]) => void;
  };
  flash: {
    (): { [key: string]: string[] };
    (message: string): string[];
    (type: string, message: string | string[]): number;
    (type: string, format: string, ...args: any[]): number;
  };
  validated?: boolean;
  isAuthenticated(): boolean;
  csrfToken(): string;
}

export interface Response extends express.Response {}

export interface NextFunction extends express.NextFunction {}

export interface RequestHandler extends express.RequestHandler {
  (req: Request, res: Response, next: NextFunction): void;
}
