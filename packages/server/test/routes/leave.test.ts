import * as render from 'serverutils/render';

import { leaveHandler } from '../../src/router/routes/leave';
import { call } from '../test-utils/transport';

jest.mock('serverutils/render', () => ({
  render: jest.fn(),
}));

describe('Leave warning page', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the warning page for an http(s) link', async () => {
    await call(leaveHandler as any)
      .withQuery({ url: 'https://example.com/a b' })
      .send();

    expect(render.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'LeaveWarningPage',
      {
        url: 'https://example.com/a%20b',
      },
      { title: 'External Link' },
    );
  });

  it.each([
    ['javascript: URL', 'javascript:alert(document.cookie)'],
    ['mixed-case javascript: URL', ' JaVaScRiPt:alert(1)'],
    ['data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['relative path', '/user/logout'],
    ['protocol-relative URL', '//evil.example'],
    ['missing url', undefined],
    ['repeated url', ['https://example.com', 'javascript:alert(1)']],
  ])('shows an error page instead for a %s', async (_label, url) => {
    const res = await call(leaveHandler as any)
      .withQuery({ url })
      .send();

    expect(res.status).toEqual(400);
    expect(render.render).toHaveBeenCalledTimes(1);
    expect(render.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'ErrorPage',
      expect.objectContaining({ title: 'Invalid link' }),
      expect.objectContaining({ title: 'Invalid Link' }),
    );
  });
});
