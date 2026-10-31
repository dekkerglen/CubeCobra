import User from '@utils/datatypes/User';

import { NextFunction, Request, Response } from '../../src/types/express';
import { createUser } from './data';

export const createMockRequest = (partialRequest?: Partial<Request>): Request => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    logger: {
      error: jest.fn(),
      info: jest.fn(),
    },
    ...partialRequest,
  } as Request;
};

interface MockResponse extends Response {
  statusCode: number;
  responseBody: any;
  writeEnabled: boolean;
  /** Headers captured from setHeader, so download tests can assert on Content-disposition. */
  sentHeaders: Record<string, any>;

  status(code: number): this;

  json(payload: any): this;

  send(payload: any): this;
}

export const createMockResponse = (locals: Record<string, any>): MockResponse => {
  const res: Partial<MockResponse> = {
    statusCode: 200,
    responseBody: undefined,
    writeEnabled: true,
    sentHeaders: {},
    status(code: number): MockResponse {
      this.statusCode = code;
      return this as MockResponse;
    },
    json(payload: any): MockResponse {
      this.responseBody = payload;
      this.writeEnabled = false;
      return this as MockResponse;
    },
    send(payload: any): MockResponse {
      this.responseBody = payload;
      this.writeEnabled = false;
      return this as MockResponse;
    },
    setHeader(name: string, value: any): MockResponse {
      this.sentHeaders![name] = value;
      return this as MockResponse;
    },
    // File download handlers stream their payload rather than calling send/json, so accumulate it.
    write(chunk: any): boolean {
      this.responseBody = `${this.responseBody ?? ''}${chunk}`;
      return true;
    },
    end(chunk?: any): MockResponse {
      if (chunk !== undefined) {
        this.responseBody = `${this.responseBody ?? ''}${chunk}`;
      }
      this.writeEnabled = false;
      return this as MockResponse;
    },
    contentType(): MockResponse {
      return this as MockResponse;
    },
    set(): MockResponse {
      return this as MockResponse;
    },
    locals,
  };

  return res as MockResponse;
};

type Handler = (req: Request, res: Response) => Promise<any | void>;
type MiddlewareHandler = (req: Request, res: Response, next: NextFunction) => void;

class CallBuilder {
  private readonly handler: Handler | MiddlewareHandler;
  private request: Partial<Request> = {};
  private responseLocals: Record<string, any> = {};
  private user?: Partial<User>;
  private flash?: (type: string, message: string) => void;

  constructor(handler: Handler | MiddlewareHandler) {
    this.handler = handler;
  }

  withRequest(request: Partial<Request>): CallBuilder {
    this.request = request;
    return this;
  }

  /**
   * Useful when locals are added to a response from a middleware and you need to mock the value in the handler
   */
  withResponseLocals(locals: Record<string, any>): CallBuilder {
    this.responseLocals = locals;
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

  as(user: User): CallBuilder {
    this.user = user;
    return this;
  }

  withFlash(flash: (type: string, message: string) => void) {
    this.flash = flash;
    return this;
  }

  async send(): Promise<{
    status: number;
    body: any;
    nextCalled: boolean;
    rawResponse: MockResponse;
    rawRequest: Request;
  }> {
    if (this.user) {
      this.request = { user: createUser(this.user), ...this.request };
    }

    if (this.flash) {
      this.request = { flash: this.flash as any, ...this.request };
    }

    const req = createMockRequest(this.request);
    const res = createMockResponse(this.responseLocals);

    //No-op next function
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await this.handler(req, res, next);

    return { status: res.statusCode, body: res.responseBody, nextCalled, rawResponse: res, rawRequest: req };
  }
}

export const call = (handler: (req: Request, res: Response) => Promise<any | void>): CallBuilder => {
  return new CallBuilder(handler);
};

export const middleware = (handler: (req: Request, res: Response, next: NextFunction) => void): CallBuilder => {
  return new CallBuilder(handler);
};
