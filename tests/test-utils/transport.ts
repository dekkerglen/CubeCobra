import User from 'datatypes/User';

import { Request, Response } from '../../src/types/express';
import { createUser } from './data';

export const createMockRequest = (partialRequest?: Partial<Request>): Request => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    user: {
      id: '0001',
      username: 'admin',
    },
    ...partialRequest,
  } as Request;
};

export const createMockResponse = (overrides?: Partial<Response>): Response => {
  const res: Partial<Response> = {
    status: (code: number) => {
      res.statusCode = code;
      return res as Response;
    },

    json: jest.fn(),
    send: jest.fn(),
    ...overrides,
  } as Response;

  return res as Response;
};

/**
 * Calls a handler and passes the partial request if provided
 * @param handler
 * @param request
 */
export const callHandler = async (
  handler: (request: Request, response: Response) => void,
  request?: Partial<Request>,
) => {
  return handler(createMockRequest(request), createMockResponse());
};

type Handler = (req: Request, res: Response) => Promise<any | void>;

class CallBuilder {
  private readonly handler: Handler;
  private request: Partial<Request> = {};
  private response: Partial<Response> = {};
  private user?: Partial<User>;
  private flash?: (type: string, message: string) => void;

  constructor(handler: Handler) {
    this.handler = handler;
  }

  withRequest(request: Partial<Request>): CallBuilder {
    this.request = request;
    return this;
  }

  withResponse(response: Partial<Response>): CallBuilder {
    this.response = response;
    return this;
  }

  as(user: User): CallBuilder {
    this.user = user;
    return this;
  }

  withFlash(flash: (type: string, message: string) => void) {
    this.flash = flash;
    return this;
  }

  async send(): Promise<void> {
    if (this.user) {
      this.request = { user: createUser(this.user), ...this.request };
    }

    if (this.flash) {
      this.request = { flash: this.flash, ...this.request };
    }

    return this.handler(createMockRequest(this.request), createMockResponse(this.response));
  }
}

export const call = (handler: (req: Request, res: Response) => Promise<any | void>): CallBuilder => {
  return new CallBuilder(handler);
};
