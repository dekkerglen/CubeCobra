import React from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import CollaboratorsSettings from 'components/settings/CollaboratorsSettings';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext, { CubeContextValue } from 'contexts/CubeContext';
import UserContext, { UserContextValue } from 'contexts/UserContext';

const CUBE_ID = 'cube-full-id';

const owner = { id: 'owner-1', username: 'owner' } as UserContextValue;
const alice = { id: 'u-alice', username: 'alice', imageUri: 'https://cdn.example/alice.png' };
const bob = { id: 'u-bob', username: 'bob', imageUri: null };
const carol = { id: 'u-carol', username: 'carol', imageUri: null };

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 400, json: async () => body }) as Response;

interface Routes {
  list?: { collaborators: (typeof alice | typeof bob)[]; pending?: (typeof alice | typeof bob)[] };
  add?: Response;
  cancel?: Response;
}

const makeFetch = ({ list = { collaborators: [], pending: [] }, add, cancel }: Routes) =>
  jest.fn(async (url: RequestInfo, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET' && url === `/cube/api/collaborators/${CUBE_ID}`) {
      return jsonResponse({ success: 'true', ...list });
    }
    if (method === 'POST' && url === `/cube/api/collaborators/${CUBE_ID}/add` && add) return add;
    if (method === 'DELETE' && String(url).startsWith(`/cube/api/collaborators/${CUBE_ID}/invite/`) && cancel) {
      return cancel;
    }
    throw new Error(`unexpected ${method} ${url}`);
  });

const renderSettings = (csrfFetch: jest.Mock, setCube = jest.fn()) => {
  const cubeValue = { cube: { id: CUBE_ID, collaborators: [] }, setCube, isOwner: true } as unknown as CubeContextValue;
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() }}>
      <UserContext.Provider value={owner}>
        <CubeContext.Provider value={cubeValue}>
          <CollaboratorsSettings />
        </CubeContext.Provider>
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );
  return { setCube };
};

const pendingSection = () => screen.getByRole('region', { name: 'Pending invites' });

describe('CollaboratorsSettings', () => {
  it('renders pending invites with a cancel action', async () => {
    renderSettings(makeFetch({ list: { collaborators: [alice], pending: [bob] } }));

    const pending = await waitFor(pendingSection);
    expect(within(pending).getByText('bob')).toBeInTheDocument();
    expect(within(pending).getByRole('button', { name: 'Cancel invite to bob' })).toBeInTheDocument();
    expect(within(pending).queryByText('alice')).not.toBeInTheDocument();
  });

  it('an invite lands in pending, not collaborators', async () => {
    const csrfFetch = makeFetch({
      list: { collaborators: [alice], pending: [] },
      add: jsonResponse({ success: 'true', invite: carol }),
    });
    const { setCube } = renderSettings(csrfFetch);

    await screen.findByText('alice');
    fireEvent.change(screen.getByPlaceholderText('Exact username'), { target: { value: 'carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

    expect(await screen.findByText("carol invited. They'll be added once they accept.")).toBeInTheDocument();
    expect(within(pendingSection()).getByText('carol')).toBeInTheDocument();
    expect(setCube).not.toHaveBeenCalled();
    expect(csrfFetch).toHaveBeenCalledWith(
      `/cube/api/collaborators/${CUBE_ID}/add`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ username: 'carol' }) }),
    );
  });

  it('cancel removes the pending row', async () => {
    const csrfFetch = makeFetch({
      list: { collaborators: [], pending: [bob] },
      cancel: jsonResponse({ success: 'true' }),
    });
    const { setCube } = renderSettings(csrfFetch);

    const pending = await waitFor(pendingSection);
    fireEvent.click(within(pending).getByRole('button', { name: 'Cancel invite to bob' }));

    await waitFor(() => expect(screen.queryByText('bob')).not.toBeInTheDocument());
    expect(csrfFetch).toHaveBeenCalledWith(
      `/cube/api/collaborators/${CUBE_ID}/invite/${bob.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(setCube).not.toHaveBeenCalled();
  });
});
