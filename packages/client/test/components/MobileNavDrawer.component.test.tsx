import React from 'react';

// Must come before anything that imports @headlessui/react — see the module for why.
import '../test-utils/mockAnimationsApi';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Notification, { NotificationStatus } from '@utils/datatypes/Notification';
import { UserRoles } from '@utils/datatypes/User';

import MobileNavDrawer from 'components/nav/MobileNavDrawer';
import UserContext, { UserContextValue } from 'contexts/UserContext';

const baseUser: UserContextValue = {
  id: 'u1',
  username: 'demo',
  roles: [] as UserRoles[],
  notifications: [] as Notification[],
  followerCount: 12,
  followingCount: 7,
  image: { uri: 'https://cdn.example/avatar.png', artist: 'An Artist', id: 'img1', imageName: 'Ambush Viper' },
};

// The drawer only counts unread notifications, but the fixture is a real Notification so a change
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

// render.ts sends the nav a trimmed cube -- id, shortId, name and the image uri only -- but the
// client's User type still declares `cubes: Cube[]`, so the fixture is cast to the shape the
// component is actually handed rather than filling in forty fields it never reads.
type NavCube = Cube & { imageUri?: string };
const navCube = (fields: Pick<NavCube, 'id' | 'shortId' | 'name'> & { imageUri?: string }): NavCube =>
  fields as NavCube;

const cubeWithImage = navCube({
  id: 'owned-1',
  shortId: 'owned',
  name: 'Owned Cube',
  imageUri: 'https://cdn.example/owned.png',
});
const cubeWithoutImage = navCube({ id: 'owned-2', shortId: 'imageless', name: 'Imageless Cube' });
const collaboratingCube = navCube({ id: 'collab-1', shortId: 'collab', name: 'Collaborating Cube' });

const cubeRun = (prefix: string, count: number): NavCube[] =>
  Array.from({ length: count }, (_unused, index) =>
    navCube({ id: `${prefix}-${index}`, shortId: `${prefix}${index}`, name: `${prefix} cube ${index}` }),
  );

const cubesUser: UserContextValue = {
  ...baseUser,
  cubes: [cubeWithImage, cubeWithoutImage],
  collaboratingCubes: [collaboratingCube],
};

interface RenderOptions {
  user?: UserContextValue | null;
  side?: 'left' | 'right';
  setOpen?: jest.Mock;
  pathname?: string;
  isOpen?: boolean;
}

// The drawer reads window.location.pathname in an effect rather than taking a prop, so the tests
// move the browser to the page under test the way a navigation would.
const renderDrawer = ({
  user = baseUser,
  side = 'left',
  setOpen = jest.fn(),
  pathname = '/',
  isOpen = true,
}: RenderOptions = {}) => {
  window.history.pushState({}, '', pathname);
  const tree = (open: boolean) => (
    <UserContext.Provider value={user}>
      <MobileNavDrawer isOpen={open} setOpen={setOpen} side={side} />
    </UserContext.Provider>
  );
  const result = render(tree(isOpen));
  return { ...result, open: (next: boolean) => result.rerender(tree(next)) };
};

const panel = () => screen.getByRole('navigation');

// The backdrop has no accessible identity of its own, so it is found as the piece of dialog chrome
// that is not the panel. Clicking it is what the dismissal contract is actually about.
const backdrop = () => {
  const dialog = screen.getByRole('dialog');
  const found = Array.from(dialog.querySelectorAll('div')).find((el) => !el.contains(panel()));
  if (!found) {
    throw new Error('no backdrop element found inside the drawer dialog');
  }
  return found;
};

describe('MobileNavDrawer', () => {
  it("renders nothing into the caller's subtree while closed", () => {
    const { container } = renderDrawer({ side: 'left', isOpen: false });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('dismisses on Escape', async () => {
    const setOpen = jest.fn();
    renderDrawer({ side: 'left', setOpen });

    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });

    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
  });

  // The same contract with focus parked on a row, which is where it sits once a visitor has tabbed
  // into the panel. Dismissal must not depend on where inside the drawer the keystroke came from.
  it('dismisses on Escape pressed from inside the panel', async () => {
    const setOpen = jest.fn();
    renderDrawer({ side: 'left', setOpen });

    const row = screen.getByRole('link', { name: 'Home' });
    act(() => row.focus());
    expect(document.activeElement).toBe(row);

    fireEvent.keyDown(row, { key: 'Escape' });

    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
  });

  // The real-world path: the drawer is mounted closed and opened by a tap on the bar. That runs a
  // genuine Headless UI enter transition, which mounting already-open skips entirely. The test
  // waits for `data-transition` to clear so the keystroke lands on a settled, fully open drawer.
  it('dismisses on Escape after being opened from closed', async () => {
    const setOpen = jest.fn();
    const { open } = renderDrawer({ side: 'left', setOpen, isOpen: false });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    open(true);
    expect(await screen.findByRole('navigation')).toHaveAttribute('data-enter');
    await waitFor(() => expect(panel()).not.toHaveAttribute('data-transition'));

    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });

    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
  });

  it('dismisses on a backdrop tap', async () => {
    const setOpen = jest.fn();
    renderDrawer({ side: 'left', setOpen });

    const target = backdrop();
    fireEvent.pointerDown(target);
    fireEvent.pointerUp(target);

    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
  });

  it('labels every destination with text', () => {
    renderDrawer({ side: 'left' });

    ['Home', 'Notifications', 'Cubes', 'Cards', 'Sets', 'Packages', 'Profile', 'Settings'].forEach((label) =>
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument(),
    );
  });

  it('anchors the panel to the side it was given and names the drawer for it', () => {
    const { unmount } = renderDrawer({ side: 'left' });
    expect(panel()).toHaveClass('left-0');
    expect(screen.getByRole('dialog', { name: 'Main menu' })).toBeInTheDocument();
    unmount();

    renderDrawer({ side: 'right' });
    expect(panel()).toHaveClass('right-0');
    expect(screen.getByRole('dialog', { name: 'Your cubes' })).toBeInTheDocument();
  });

  it('marks the current page and only the current page', () => {
    renderDrawer({ side: 'left', pathname: '/packages' });

    expect(screen.getByRole('link', { name: 'Packages' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(panel().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('keeps a section marked on its sub-pages', () => {
    renderDrawer({ side: 'left', pathname: '/packages/liked/u1' });

    expect(screen.getByRole('link', { name: 'Packages' })).toHaveAttribute('aria-current', 'page');
  });

  it('treats the dashboard as Home', () => {
    renderDrawer({ side: 'left', pathname: '/dashboard' });

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(panel().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('hides role rows from a user holding neither role', () => {
    renderDrawer({ user: { ...baseUser, roles: [] }, side: 'left' });

    expect(screen.queryByRole('link', { name: 'Admin Page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Content Creator Dashboard' })).not.toBeInTheDocument();
  });

  it('shows each role row to the role that owns it', () => {
    const { unmount } = renderDrawer({ user: { ...baseUser, roles: [UserRoles.ADMIN] }, side: 'left' });
    expect(screen.getByRole('link', { name: 'Admin Page' })).toHaveAttribute('href', '/admin/dashboard');
    expect(screen.queryByRole('link', { name: 'Content Creator Dashboard' })).not.toBeInTheDocument();
    unmount();

    renderDrawer({ user: { ...baseUser, roles: [UserRoles.CONTENT_CREATOR] }, side: 'left' });
    expect(screen.getByRole('link', { name: 'Content Creator Dashboard' })).toHaveAttribute(
      'href',
      '/content/creators',
    );
    expect(screen.queryByRole('link', { name: 'Admin Page' })).not.toBeInTheDocument();
  });

  it('gives a signed-out visitor account buttons and no personal rows', () => {
    renderDrawer({ user: null, side: 'left' });

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/user/login');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/user/register');
    expect(screen.queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('still offers the public destinations to a signed-out visitor', () => {
    renderDrawer({ user: null, side: 'left' });

    ['Home', 'Cubes', 'Cards', 'Sets', 'Packages', 'Resources', 'Wiki', 'Help'].forEach((label) =>
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument(),
    );
  });

  it('shows the viewer their follower and following counts', () => {
    renderDrawer({ side: 'left' });

    const profile = screen.getByRole('link', { name: /demo/ });
    expect(profile).toHaveAttribute('href', '/user/view/u1');
    expect(profile).toHaveTextContent('12');
    expect(profile).toHaveTextContent('7');
  });

  it('shows the avatar of a viewer who has one', () => {
    renderDrawer({ side: 'left' });

    const avatar = screen.getByRole('link', { name: /demo/ }).firstElementChild;
    expect(avatar?.tagName).toBe('IMG');
    expect(avatar).toHaveAttribute('src', 'https://cdn.example/avatar.png');
  });

  // A user with no avatar has no image at all, and an <img> whose src React has omitted paints a
  // bordered broken-image box. The placeholder has to hold the same slot without being an <img>.
  it('falls back to a placeholder rather than a broken image when the viewer has no avatar', () => {
    renderDrawer({ user: { ...baseUser, image: undefined }, side: 'left' });

    const profile = screen.getByRole('link', { name: /demo/ });
    expect(profile.querySelector('img')).toBeNull();
    const placeholder = profile.firstElementChild;
    expect(placeholder?.tagName).toBe('SPAN');
    expect(placeholder).toHaveClass('h-14', 'w-14', 'rounded-full');
  });

  it('counts unread notifications on their row', () => {
    renderDrawer({
      user: { ...baseUser, notifications: [notification('a'), notification('b')] },
      side: 'left',
    });

    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveTextContent('2');
  });

  it('shows no count when nothing is unread', () => {
    renderDrawer({ user: { ...baseUser, notifications: [] }, side: 'left' });

    expect(screen.getByRole('link', { name: /Notifications/ })).not.toHaveTextContent(/\d/);
  });

  it('reserves ad space for a user who sees ads, and none for a patron', () => {
    const { unmount } = renderDrawer({ user: { ...baseUser, roles: [] }, side: 'left' });
    expect(panel()).toHaveStyle({ paddingBottom: '50px' });
    unmount();

    renderDrawer({ user: { ...baseUser, roles: [UserRoles.PATRON] }, side: 'left' });
    expect(panel()).not.toHaveStyle({ paddingBottom: '50px' });
  });

  describe('the cubes side', () => {
    it('renders a thumbnail per cube, falling back when none resolved', () => {
      renderDrawer({ user: cubesUser, side: 'right' });

      // A decorative `alt=""` image carries the implicit role `presentation` and is excluded from
      // the accessibility tree, so the thumbnails are read off the DOM. The row's text already
      // names the cube; alt text would make a screen reader announce it twice.
      const images = panel().querySelectorAll('img');
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute('src', 'https://cdn.example/owned.png');
      expect(images[0]).toHaveAttribute('loading', 'lazy');

      // The imageless row holds the same slot with an icon rather than an <img> React has to
      // render without a src, which paints a broken-image box.
      const fallbackRow = screen.getByRole('link', { name: 'Imageless Cube' });
      expect(fallbackRow.querySelector('img')).toBeNull();
      expect(fallbackRow.querySelector('svg')).not.toBeNull();
    });

    it('links each cube to its list page', () => {
      renderDrawer({ user: cubesUser, side: 'right' });

      expect(screen.getByRole('link', { name: 'Owned Cube' })).toHaveAttribute('href', '/cube/list/owned');
    });

    it('keeps the actions reachable with a full cube list', () => {
      renderDrawer({
        user: { ...baseUser, cubes: cubeRun('owned', 20), collaboratingCubes: cubeRun('collab', 12) },
        side: 'right',
      });

      ['Create a New Cube', 'Liked Cubes', 'Drafts of Your Cubes', 'All Your Cubes'].forEach((label) =>
        expect(screen.getByText(label)).toBeInTheDocument(),
      );
      // jsdom runs no layout, so the flex contract that keeps those actions on screen is asserted
      // as the classes that encode it. `min-h-0` is the load-bearing one: without it the scroller
      // keeps its automatic minimum size, refuses to shrink below 32 rows of content, and pushes
      // the action block off the bottom of the panel.
      expect(screen.getByTestId('mobile-nav-cube-list')).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto');
      expect(screen.getByTestId('mobile-nav-cube-actions')).toHaveClass('shrink-0');
    });

    it('creates a cube by posting, not by navigating', () => {
      renderDrawer({ user: cubesUser, side: 'right' });

      expect(screen.getByRole('button', { name: /create a new cube/i }).closest('form')).toHaveAttribute(
        'action',
        '/cube/quickadd',
      );
      expect(screen.queryByRole('link', { name: /create a new cube/i })).not.toBeInTheDocument();
    });

    it('lists collaborating cubes in their own section', () => {
      renderDrawer({ user: cubesUser, side: 'right' });

      expect(screen.getByText('Collaborating')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Collaborating Cube' })).toHaveAttribute('href', '/cube/list/collab');
    });

    it('omits the collaborating section entirely when there are none', () => {
      renderDrawer({ user: { ...cubesUser, collaboratingCubes: [] }, side: 'right' });

      expect(screen.queryByText(/collaborating/i)).not.toBeInTheDocument();
    });

    it('shows the empty state but keeps the actions when the user owns no cubes', () => {
      renderDrawer({ user: { ...cubesUser, cubes: [] }, side: 'right' });

      expect(screen.getByText("You don't have any cubes yet.")).toBeInTheDocument();
      expect(screen.getByText('All Your Cubes')).toBeInTheDocument();
    });

    it('offers the viewer their own cube destinations', () => {
      renderDrawer({ user: cubesUser, side: 'right' });

      expect(screen.getByRole('link', { name: 'Liked Cubes' })).toHaveAttribute('href', '/cube/liked/u1');
      expect(screen.getByRole('link', { name: 'Drafts of Your Cubes' })).toHaveAttribute('href', '/dashboard/drafts');
      expect(screen.getByRole('link', { name: 'All Your Cubes' })).toHaveAttribute('href', '/user/view/u1');
    });

    it('offers the viewer their own package destinations', () => {
      renderDrawer({ user: cubesUser, side: 'right' });

      expect(screen.getByRole('link', { name: 'View All My Packages' })).toHaveAttribute('href', '/user/packages/u1');
      expect(screen.getByRole('link', { name: 'Liked Packages' })).toHaveAttribute('href', '/packages/liked/u1');
      expect(screen.getByRole('link', { name: 'Create a New Package' })).toHaveAttribute('href', '/packages/create');
    });

    it('carries the full name for a truncated cube', () => {
      const longNamedCube = navCube({
        id: 'long-1',
        shortId: 'long',
        name: 'An Extremely Long Cube Name That Will Not Fit Across A Phone Screen',
      });
      renderDrawer({ user: { ...cubesUser, cubes: [longNamedCube] }, side: 'right' });

      const row = screen.getByRole('link', { name: new RegExp(longNamedCube.name) });
      expect(row).toHaveAttribute('title', longNamedCube.name);
      expect(row.querySelector('.truncate')).not.toBeNull();
    });

    it('renders nothing for a signed-out visitor', () => {
      renderDrawer({ user: null, side: 'right' });

      expect(screen.queryByText('Your Cubes')).not.toBeInTheDocument();
      expect(screen.queryByText('All Your Cubes')).not.toBeInTheDocument();
      expect(panel()).toBeEmptyDOMElement();
    });
  });
});
