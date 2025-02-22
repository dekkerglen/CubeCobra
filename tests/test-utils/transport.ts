import User from '../../src/datatypes/User';
import { Request, Response } from '../../src/types/express';
import { createUser } from './data';

export const createMockRequest = (partialRequest?: Partial<Request>): Request => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    logger: {
      error: jest.fn(),
    },
    ...partialRequest,
  } as Request;
};

export const createMockResponse = (overrides?: Partial<Response>): Response => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
    ...overrides,
  } as Response;

  return res as Response;
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

  withQuery(query: any): CallBuilder {
    this.request.query = query;
    return this;
  }

  withParams(params: any): CallBuilder {
    this.request.params = params;
    return this;
  }

  withBody(body: any): CallBuilder {
    this.request.body = body;
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
