import { createHealthcheckHandler } from '../../src/serverutils/healthcheck';
import { createMockRequest, createMockResponse } from '../test-utils/transport';

const check = (ready: boolean) => {
  const res = createMockResponse({});
  createHealthcheckHandler(() => ready)(createMockRequest(), res);
  return res;
};

describe('healthcheck', () => {
  it('answers OK once the app is ready', () => {
    const res = check(true);

    expect(res.statusCode).toBe(200);
    expect(res.responseBody).toBe('OK');
  });

  it('reports unavailable while the app is still starting', () => {
    expect(check(false).statusCode).toBe(503);
  });
});
