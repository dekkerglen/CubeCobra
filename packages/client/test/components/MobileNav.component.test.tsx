import React from 'react';

// Must come before anything that imports @headlessui/react — see the module for why.
import '../test-utils/mockAnimationsApi';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import Notification, { NotificationStatus } from '@utils/datatypes/Notification';
import { UserRoles } from '@utils/datatypes/User';

import MobileNav from 'components/nav/MobileNav';
import UserContext, { UserContextValue } from 'contexts/UserContext';

const user: UserContextValue = {
  id: 'u1',
  username: 'demo',
  roles: [] as UserRoles[],
  notifications: [] as Notification[],
};

// The bar only reads whether anything is unread, but the fixture is a real Notification so a change
// to the shape it reads is a compile error rather than a silently passing test.
const notification = (id: string): Notification => ({
  id,
  to: 'u1',
  body: `notification ${id}`,
  date: 0,
  dateCreated: 0,
  dateLastUpdated: 0,
  status: NotificationStatus.UNREAD,
  toStatusComp: `u1:${NotificationStatus.UNREAD}`,
});

type MediaListener = (event: MediaQueryListEvent) => void;

// jsdom ships no matchMedia, and the bar's only defence against a drawer surviving the jump past
// 768px is the listener it registers here. The stub keeps real bookkeeping — the queries it was
// asked for, and the listeners actually added and removed — so a missing, mis-keyed or un-cleaned
// registration shows up as a failing assertion instead of passing against a no-op mock.
const media: { queries: string[]; types: string[]; listeners: MediaListener[] } = {
  queries: [],
  types: [],
  listeners: [],
};

const installMatchMedia = () => {
  media.queries = [];
  media.types = [];
  media.listeners = [];
  window.matchMedia = ((query: string) =>
    ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: (type: string, listener: MediaListener) => {
        media.queries.push(query);
        media.types.push(type);
        media.listeners.push(listener);
      },
      removeEventListener: (_type: string, listener: MediaListener) => {
        media.listeners = media.listeners.filter((existing) => existing !== listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
};

const fireMediaChange = (event: { matches: boolean }) =>
  media.listeners.forEach((listener) => listener(event as MediaQueryListEvent));

const renderNav = (value: UserContextValue | null) =>
  render(
    <UserContext.Provider value={value}>
      <MobileNav />
    </UserContext.Provider>,
  );

describe('MobileNav', () => {
  beforeEach(() => {
    installMatchMedia();
  });

  it('offers exactly a menu button, the logo, and a cubes button', () => {
    const { container } = renderNav(user);

    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /your cubes/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);

    const logo = screen.getByRole('link', { name: /cube cobra/i });
    expect(logo).toHaveAttribute('href', '/');

    // jsdom runs no layout, so the bar's geometry is asserted as the classes that encode it. `h-10`
    // is the load-bearing one: the logo is taken out of flow to stay centred against the bar rather
    // than between its slots, so without a height on the bar itself the whole row collapses.
    expect(container.firstChild).toHaveClass('relative', 'flex', 'h-10', 'items-center');
  });

  it('carries the full wordmark, kept clear of both icon buttons', () => {
    renderNav(user);

    const logo = screen.getByRole('link', { name: /cube cobra/i });
    // The extended lockup the desktop bar uses, not the bare icon.
    expect(logo.querySelector('img')).toHaveAttribute('src', expect.stringContaining('banner.png'));
    // At its natural height the wordmark is wide enough to reach the buttons on a narrow phone, so
    // the box reserves room for both and the image scales down inside it instead of colliding.
    expect(logo).toHaveClass('max-w-[calc(100%-7rem)]');
    expect(logo.querySelector('img')).toHaveClass('max-w-full', 'object-contain');
    // Centring that survives the cubes button being withheld from a signed-out visitor: auto
    // margins against both insets, rather than a half-width offset that also caps the box at 50%.
    expect(logo).toHaveClass('inset-x-0', 'mx-auto');
  });

  it('withholds the cubes button from a signed-out visitor', () => {
    renderNav(null);

    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /your cubes/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('marks unread notifications on the menu button', () => {
    renderNav({ ...user, notifications: [notification('n1')] });

    expect(screen.getByTestId('mobile-nav-unread-dot')).toBeInTheDocument();
  });

  it('names the menu button for unread notifications, since the dot is invisible to a screen reader', () => {
    renderNav({ ...user, notifications: [notification('n1')] });

    expect(screen.getByRole('button', { name: /unread notifications/i })).toBeInTheDocument();
  });

  it('does not claim unread notifications when there are none', () => {
    renderNav(user);

    expect(screen.queryByRole('button', { name: /unread/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('shows no unread marker when there is nothing unread', () => {
    renderNav(user);

    expect(screen.queryByTestId('mobile-nav-unread-dot')).not.toBeInTheDocument();
  });

  it('shows no unread marker for a signed-out visitor', () => {
    renderNav(null);

    expect(screen.queryByTestId('mobile-nav-unread-dot')).not.toBeInTheDocument();
  });

  it('opens the main menu drawer from the menu button', async () => {
    renderNav(user);

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(await screen.findByRole('dialog')).toHaveAttribute('aria-label', 'Main menu');
  });

  it('opens the cubes drawer from the cubes button', async () => {
    renderNav(user);

    fireEvent.click(screen.getByRole('button', { name: /your cubes/i }));

    expect(await screen.findByRole('dialog')).toHaveAttribute('aria-label', 'Your cubes');
  });

  it('renders the drawer outside the bar so the page cannot be displaced', () => {
    const { container } = renderNav(user);

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('dismisses a drawer when it asks to close', async () => {
    renderNav(user);

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('watches the desktop breakpoint', () => {
    renderNav(user);

    expect(media.queries).toEqual(['(min-width: 768px)']);
    // A MediaQueryList only reports breakpoint crossings as `change`; any other event name
    // registers a listener that never fires.
    expect(media.types).toEqual(['change']);
  });

  it('closes an open drawer when the viewport reaches the desktop breakpoint', async () => {
    renderNav(user);

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => fireMediaChange({ matches: true }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('leaves an open drawer alone while the viewport stays below the breakpoint', () => {
    renderNav(user);

    fireEvent.click(screen.getByRole('button', { name: /your cubes/i }));

    act(() => fireMediaChange({ matches: false }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stops watching the breakpoint once unmounted', () => {
    const { unmount } = renderNav(user);

    expect(media.listeners).toHaveLength(1);

    unmount();

    expect(media.listeners).toHaveLength(0);
  });

  it('renders without a matchMedia implementation', () => {
    // Any non-browser consumer; the bar must still paint.
    (window as Partial<Window>).matchMedia = undefined;

    expect(() => renderNav(user)).not.toThrow();
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('renders when the media query list cannot be subscribed to', () => {
    // Safari before 14 returns a MediaQueryList with only the deprecated addListener pair. The bar
    // sits inside the layout every page renders, so throwing here would blank the whole site.
    window.matchMedia = ((query: string) =>
      ({
        media: query,
        matches: false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    expect(() => renderNav(user)).not.toThrow();
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });
});
