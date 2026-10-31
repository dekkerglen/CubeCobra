import React, { useContext, useEffect, useState } from 'react';

import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import type { Icon as OcticonIcon } from '@primer/octicons-react';
import {
  BellFillIcon,
  BookIcon,
  BroadcastIcon,
  ChevronRightIcon,
  GearIcon,
  GraphIcon,
  HomeIcon,
  ListOrderedIcon,
  PackageIcon,
  PersonIcon,
  QuestionIcon,
  SearchIcon,
  ShareAndroidIcon,
  ShieldCheckIcon,
  StackIcon,
  TableIcon,
  ToolsIcon,
  TypographyIcon,
  VersionsIcon,
} from '@primer/octicons-react';
import { isAdFree } from '@utils/adsUtil';
import type Cube from '@utils/datatypes/Cube';
import { UserRoles } from '@utils/datatypes/User';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import UserContext from '../../contexts/UserContext';
import withQuickCreateCube from '../QuickCreateCubeButton';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  side: 'left' | 'right';
}

type Row = { label: string; href: string; icon: OcticonIcon };

// Mobile-only merge: /search and /tool/searchcards each carry their own sort and view controls on
// the page, so the Popular / Recently Updated / Search triplets collapse to one row apiece here.
// The desktop nav keeps all of its shortcuts.
const browseRows: Row[] = [
  { label: 'Cubes', href: '/search', icon: SearchIcon },
  { label: 'Cards', href: '/tool/searchcards', icon: GraphIcon },
  { label: 'Sets', href: '/tool/sets', icon: StackIcon },
  { label: 'Packages', href: '/packages', icon: VersionsIcon },
];

const dailyRows: Row[] = [
  { label: 'Mana Matrix', href: '/tool/manamatrix', icon: TableIcon },
  { label: 'Synergy Connect', href: '/tool/synergyconnect', icon: ShareAndroidIcon },
  { label: 'Crossword', href: '/tool/crossword', icon: TypographyIcon },
  { label: 'Daily P1P1', href: '/tool/p1p1/daily', icon: ListOrderedIcon },
];

const siteRows: Row[] = [
  { label: 'Resources', href: '/resources', icon: ToolsIcon },
  { label: 'Wiki', href: '/wiki', icon: BookIcon },
  { label: 'Help', href: '/help', icon: QuestionIcon },
];

const roleRows: { role: UserRoles; row: Row }[] = [
  { role: UserRoles.ADMIN, row: { label: 'Admin Page', href: '/admin/dashboard', icon: ShieldCheckIcon } },
  {
    role: UserRoles.CONTENT_CREATOR,
    row: { label: 'Content Creator Dashboard', href: '/content/creators', icon: BroadcastIcon },
  },
];

const HOME_PATHS = ['/', '/landing', '/dashboard'];

// Owned cubes arrive from the server already capped at 20; collaborating cubes do not, so the
// drawer applies the same dozen the desktop cubes panel shows.
const COLLABORATING_LIMIT = 12;

// Section matching, so Packages stays marked on /packages/liked/:id. The segment boundary keeps a
// row from claiming an unrelated path that merely starts with the same characters.
const isRowActive = (href: string, pathname: string): boolean => {
  if (href === '/') {
    return HOME_PATHS.includes(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};

const NavRow: React.FC<{ row: Row; pathname: string; badge?: string }> = ({ row, pathname, badge }) => {
  const Icon = row.icon;
  const active = isRowActive(row.href, pathname);
  return (
    <a
      href={row.href}
      aria-current={active ? 'page' : undefined}
      // Octicons ships a filled twin for only three of the glyphs used here, so an active state
      // that swaps to a filled icon would appear on three rows and do nothing on the rest. Colour
      // plus a row background carries it instead, matching CubeBottomNav's green convention.
      // Inactive rows stay at full strength; dimming them reads as disabled.
      className={classNames('flex items-center gap-3 rounded-md px-3 py-2.5 text-base hover:bg-bg-active', {
        'bg-bg-active font-bold text-green-500': active,
        'text-text': !active,
      })}
    >
      <Icon size={20} />
      <span>{row.label}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-button-danger px-2 py-0.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </a>
  );
};

const Divider: React.FC = () => <div className="my-3 border-t border-border" />;

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-text-secondary">{children}</div>
);

// `cubes` and `collaboratingCubes` arrive from render.ts as a trimmed cube that carries the image
// uri alone, but the shared User type still declares them as full Cubes. The field is read through
// a local cast rather than widening Cube, which would claim every cube everywhere carries it.
const CubeRow: React.FC<{ cube: Cube }> = ({ cube }) => {
  const { imageUri } = cube as Cube & { imageUri?: string };
  return (
    <a
      href={`/cube/list/${encodeURIComponent(getCubeId(cube))}`}
      // A name too long for a phone screen is clipped, so the full one rides along in the tooltip
      // and in the link's accessible name.
      title={cube.name}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-base text-text hover:bg-bg-active"
    >
      {imageUri ? (
        <img
          src={imageUri}
          alt=""
          loading="lazy"
          className="h-8 w-8 shrink-0 rounded border border-border object-cover"
        />
      ) : (
        // Defensive: every DAO-hydrated cube resolves an image, but a cube assembled elsewhere
        // would render an <img> with no src, which paints a bordered broken-image box.
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-bg-active text-text-secondary">
          <PackageIcon size={16} />
        </span>
      )}
      {/* `truncate` ellipses here only because its `overflow: hidden` forces this flex child's
          automatic minimum size to zero; the computed `min-width` stays `auto`. */}
      <span className="truncate">{cube.name}</span>
    </a>
  );
};

const actionClasses = 'block rounded-md px-3 py-2.5 text-left text-base text-text hover:bg-bg-active';

const ActionLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} className={actionClasses}>
    {children}
  </a>
);

const ActionButton: React.FC<{ children?: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <button type="button" onClick={onClick} className={classNames(actionClasses, 'w-full')}>
    {children}
  </button>
);

// There is no cube creation page to link to: a new cube is a CSRF POST to /cube/quickadd, which
// creates it and redirects. Built once at module scope so the form is not remounted on each render.
const CreateCubeAction = withQuickCreateCube(ActionButton);

const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ isOpen, setOpen, side }) => {
  const user = useContext(UserContext);
  const [pathname, setPathname] = useState('');

  // window is read from an effect rather than during render, so nothing touches a browser global
  // while rendering. No row is marked active until this lands; that first-paint flash is accepted.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => setPathname(window.location.pathname), []);

  const unread = (user?.notifications || []).length;
  const shouldShowAds = !isAdFree(user?.roles);

  const profileBlock = user ? (
    <a
      href={`/user/view/${user.id}`}
      className="flex flex-row items-center gap-3 rounded-md px-3 py-2 hover:bg-bg-active"
    >
      {user.image?.uri ? (
        <img
          src={user.image.uri}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        // A user with no avatar has no `image` at all. Rendering the <img> anyway omits `src`
        // entirely, which paints a bordered broken-image box with no alt text to explain it, so
        // fall back to the neutral placeholder shape RecordAllDecks already uses for this case.
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-bg-active text-text-secondary">
          <PersonIcon size={24} />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-lg font-bold text-text" title={user.username}>
          {user.username}
        </span>
        <span className="text-sm text-text-secondary">
          <strong className="text-text">{user.followerCount ?? 0}</strong> followers &middot;{' '}
          <strong className="text-text">{user.followingCount ?? 0}</strong> following
        </span>
      </div>
      <ChevronRightIcon size={16} className="ml-auto shrink-0 text-text-secondary" />
    </a>
  ) : (
    <div className="flex flex-col gap-3 px-3 pb-1 pt-2">
      <span className="text-lg font-bold text-text">Build your cube</span>
      <div className="flex flex-row gap-2">
        <a
          href="/user/register"
          className="rounded-full bg-button-primary px-4 py-2 text-sm font-semibold text-button-text"
        >
          Create account
        </a>
        {/* A link, not LoginModal: the drawer is already a Dialog, and nesting a second one means
            two focus traps and an ambiguous backdrop click. */}
        <a href="/user/login" className="rounded-full bg-bg-active px-4 py-2 text-sm font-semibold text-text">
          Sign in
        </a>
      </div>
    </div>
  );

  const leftContent = (
    <div className="flex flex-col">
      {profileBlock}

      <Divider />

      <NavRow row={{ label: 'Home', href: '/', icon: HomeIcon }} pathname={pathname} />
      {user && (
        <NavRow
          row={{ label: 'Notifications', href: '/user/notifications', icon: BellFillIcon }}
          pathname={pathname}
          // render.ts forwards unread notifications through getByToAndStatus, which caps at 99, so
          // the overflow form is defensive rather than reachable.
          badge={unread > 0 ? (unread > 99 ? '99+' : `${unread}`) : undefined}
        />
      )}
      {[...browseRows, ...dailyRows].map((row) => (
        <NavRow key={row.href} row={row} pathname={pathname} />
      ))}
      {user && (
        <>
          <NavRow row={{ label: 'Profile', href: `/user/view/${user.id}`, icon: PersonIcon }} pathname={pathname} />
          <NavRow row={{ label: 'Settings', href: '/user/account', icon: GearIcon }} pathname={pathname} />
        </>
      )}
      {roleRows
        .filter(({ role }) => user?.roles?.includes(role))
        .map(({ row }) => (
          <NavRow key={row.href} row={row} pathname={pathname} />
        ))}

      <Divider />

      {siteRows.map((row) => (
        <NavRow key={row.href} row={row} pathname={pathname} />
      ))}

      <Divider />

      <div className="flex flex-row flex-wrap gap-x-4 gap-y-1 px-3 pb-2 text-sm">
        <a href="/privacy" className="text-link">
          Privacy Policy
        </a>
        <a href="/tos" className="text-link">
          Terms &amp; Conditions
        </a>
      </div>
    </div>
  );

  // Nothing at all for a signed-out visitor: every destination here is personal, and user.id is
  // never read without a user.
  const rightContent = user ? (
    <div className="flex h-full flex-col">
      {/* min-h-0 is load-bearing: a flex item's automatic minimum size is its content, so without
          it a full cube list refuses to shrink and pushes the action block off the panel. */}
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="mobile-nav-cube-list">
        <SectionHeading>Your Cubes</SectionHeading>
        {(user.cubes || []).length > 0 ? (
          (user.cubes || []).map((cube) => <CubeRow key={cube.id} cube={cube} />)
        ) : (
          <p className="px-3 py-2 text-sm text-text-secondary">You don&apos;t have any cubes yet.</p>
        )}
        {(user.collaboratingCubes || []).length > 0 && (
          <>
            <SectionHeading>Collaborating</SectionHeading>
            {(user.collaboratingCubes || []).slice(0, COLLABORATING_LIMIT).map((cube) => (
              <CubeRow key={cube.id} cube={cube} />
            ))}
          </>
        )}
      </div>

      <div className="shrink-0" data-testid="mobile-nav-cube-actions">
        <Divider />
        <CreateCubeAction>Create a New Cube</CreateCubeAction>
        <ActionLink href={`/cube/liked/${user.id}`}>Liked Cubes</ActionLink>
        <ActionLink href="/dashboard/drafts">Drafts of Your Cubes</ActionLink>
        <ActionLink href={`/user/view/${user.id}`}>All Your Cubes</ActionLink>
        <Divider />
        <ActionLink href={`/user/packages/${user.id}`}>View All My Packages</ActionLink>
        <ActionLink href={`/packages/liked/${user.id}`}>Liked Packages</ActionLink>
        <ActionLink href="/packages/create">Create a New Package</ActionLink>
      </div>
    </div>
  ) : null;

  return (
    <Transition show={isOpen}>
      {/* z-[60] clears CubeBottomNav's z-30 so the drawer covers the cube tab bar. */}
      <Dialog
        as="div"
        className="relative z-[60]"
        aria-label={side === 'left' ? 'Main menu' : 'Your cubes'}
        onClose={() => setOpen(false)}
      >
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-bg/75" />
        </TransitionChild>
        {/* No z-index here: the Dialog root above is `relative z-[60]`, which opens a stacking
            context this container is already inside, so repeating it would only compete with the
            backdrop that shares it. */}
        <div className="fixed inset-0 overflow-hidden">
          <TransitionChild
            enter="transform transition ease-out duration-200"
            enterFrom={side === 'left' ? '-translate-x-full' : 'translate-x-full'}
            enterTo="translate-x-0"
            leave="transform transition ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo={side === 'left' ? '-translate-x-full' : 'translate-x-full'}
          >
            <DialogPanel
              as="nav"
              className={classNames(
                'fixed inset-y-0 flex w-[82%] max-w-xs flex-col overflow-y-auto border-border bg-bg-accent p-2',
                side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
              )}
              // The NitroPay anchor is a fixed-bottom 320x50 third-party iframe that paints above
              // the document's stacking contexts, so the panel pads for it the way CubeBottomNav
              // does rather than trying to out-layer it.
              style={{ paddingBottom: shouldShowAds ? '50px' : undefined }}
            >
              {side === 'left' ? leftContent : rightContent}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

export default MobileNavDrawer;
