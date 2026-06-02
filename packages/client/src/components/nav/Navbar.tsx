import React, { useContext, useEffect, useState } from 'react';

import type { Icon as OcticonIcon } from '@primer/octicons-react';
import {
  BellFillIcon,
  ClockIcon,
  FeedPlusIcon,
  GraphIcon,
  HomeIcon,
  PackageIcon,
  PersonAddIcon,
  PersonIcon,
  QuestionIcon,
  SearchIcon,
  SignInIcon,
  StarIcon,
  ToolsIcon,
} from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import Notification from '@utils/datatypes/Notification';
import { UserRoles } from '@utils/datatypes/User';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import { CSRFContext } from '../../contexts/CSRFContext';
import UserContext from '../../contexts/UserContext';
import { CardFooter, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import NavButton from '../base/NavButton';
import NavLink from '../base/NavLink';
import NavMenu from '../base/NavMenu';
import ResponsiveDiv from '../base/ResponsiveDiv';
import LoginModal from '../modals/LoginModal';
import withQuickCreateCube from '../QuickCreateCubeButton';
import withModal from '../WithModal';
import NotificationsNav from './NotificationsNav';

const CreateCubeButton = withQuickCreateCube(NavButton);

const NAV_ITEM_CLASSES =
  'flex items-center gap-1 rounded-md select-none cursor-pointer p-2 font-semibold text-text-secondary hover:text-text-secondary-active transition-colors duration-200 ease-in-out';

type NavTriggerProps = { onClick?: () => void; className?: string; children?: React.ReactNode };
const NavLinkTrigger: React.FC<NavTriggerProps> = ({ onClick, className, children }) => (
  <a onClick={onClick} role="button" tabIndex={0} className={className}>
    {children}
  </a>
);
const LoginNavLink = withModal(NavLinkTrigger, LoginModal);

type MobileIconTriggerProps = { onClick?: () => void; className?: string };
const MobileLoginIcon: React.FC<MobileIconTriggerProps> = ({ onClick, className }) => (
  <button type="button" onClick={onClick} className={className}>
    <SignInIcon size={24} />
  </button>
);
const MobileLoginButton = withModal(MobileLoginIcon, LoginModal);

type NavSubItem = { label: string; href: string; icon?: OcticonIcon };
type NavSection = { header?: string; items: NavSubItem[] };

const exploreSections: NavSection[] = [
  {
    header: 'Cubes',
    items: [
      { label: 'Popular Cubes', href: '/search?order=pop', icon: StarIcon },
      { label: 'Recently Updated', href: '/search?order=date', icon: ClockIcon },
      { label: 'Search Cubes', href: '/search?order=alpha', icon: SearchIcon },
    ],
  },
  {
    header: 'Cards',
    items: [
      { label: 'Top Cards', href: '/tool/searchcards?v=rows', icon: GraphIcon },
      { label: 'Search Cards', href: '/tool/searchcards', icon: SearchIcon },
    ],
  },
  {
    header: 'Packages',
    items: [{ label: 'Packages', href: '/packages', icon: PackageIcon }],
  },
];

interface NavbarProps {
  transparent?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ transparent = false }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(user?.notifications || []);
  const [pathname, setPathname] = useState<string | null>(null);

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const isHomePage = pathname === '/landing' || pathname === '/dashboard';

  const toggleMobileMenu = (menuId: string) => {
    setMobileMenuOpen(mobileMenuOpen === menuId ? null : menuId);
  };

  const clearNotifications = async () => {
    await csrfFetch('/user/clearnotifications', {
      method: 'POST',
    });
    setNotifications([]);
  };

  const renderSubItem = (subItem: NavSubItem) => {
    const SubIcon = subItem.icon;
    return (
      <NavLink key={subItem.label} href={subItem.href}>
        {SubIcon ? (
          <span className="flex items-center gap-2">
            <SubIcon size={16} />
            {subItem.label}
          </span>
        ) : (
          subItem.label
        )}
      </NavLink>
    );
  };

  const homeLink = (
    <a href={isHomePage ? '#' : '/'} className={classNames(NAV_ITEM_CLASSES, 'ml-6')}>
      <span className="lg:hidden">
        <HomeIcon size={24} />
      </span>
      <span className="hidden lg:inline">Home</span>
    </a>
  );

  const exploreMenu = (
    <NavMenu label="Explore" navBar icon={<SearchIcon size={24} />} transparent={transparent}>
      <Flexbox direction="col" gap="2" className="p-3">
        {exploreSections.map((section, idx) => (
          <Flexbox direction="col" gap="1" key={section.header || `section-${idx}`}>
            {section.header && (
              <div className="text-xs uppercase font-bold text-text-secondary tracking-wide px-1 pt-1">
                {section.header}
              </div>
            )}
            {section.items.map(renderSubItem)}
          </Flexbox>
        ))}
      </Flexbox>
    </NavMenu>
  );

  const yourCubesMenu = user && (
    <NavMenu
      label={
        <>
          <span className="whitespace-nowrap xl:hidden">Cubes</span>
          <span className="whitespace-nowrap hidden xl:inline">Your Cubes</span>
        </>
      }
      navBar
      icon={<PackageIcon size={24} />}
      transparent={transparent}
    >
      <Flexbox direction="col" gap="1" className="max-h-96 overflow-auto p-2">
        {(user.cubes || []).slice(0, 20).map((item) => (
          <NavLink key={`dropdown_cube_${item.name}`} href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}>
            {item.name}
          </NavLink>
        ))}
        {(user.collaboratingCubes || []).length > 0 && (
          <>
            <div className="text-xs text-text-secondary font-semibold px-1 pt-2 pb-1">Collaborating</div>
            {(user.collaboratingCubes || []).slice(0, 12).map((item) => (
              <NavLink key={`dropdown_collab_${item.id}`} href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}>
                {item.name}
              </NavLink>
            ))}
          </>
        )}
      </Flexbox>
      <CardFooter className="border-border-secondary">
        <Flexbox direction="col" gap="2">
          {(user.cubes || []).length > 2 && <NavLink href={`/user/view/${user.id}`}>View All</NavLink>}
          <NavLink href={`/cube/liked/${user.id}`}>Liked Cubes</NavLink>
          <NavLink href="/dashboard/drafts">Drafts of Your Cubes</NavLink>
          <CreateCubeButton>Create A New Cube</CreateCubeButton>
        </Flexbox>
      </CardFooter>
    </NavMenu>
  );

  const yourPackagesMenu = user && (
    <NavMenu
      label={
        <>
          <span className="whitespace-nowrap xl:hidden">Packages</span>
          <span className="whitespace-nowrap hidden xl:inline">Your Packages</span>
        </>
      }
      navBar
      icon={<PackageIcon size={24} />}
      transparent={transparent}
    >
      <Flexbox direction="col" gap="2" className="p-3">
        <NavLink href={`/user/packages/${user.id}`}>View All My Packages</NavLink>
        <NavLink href={`/packages/liked/${user.id}`}>Liked Packages</NavLink>
        <NavLink href="/packages/create">Create A New Package</NavLink>
      </Flexbox>
    </NavMenu>
  );

  const createMenu = user && (
    <NavMenu
      label={
        <div className="flex items-center justify-center w-6 h-6">
          <FeedPlusIcon size={20} />
        </div>
      }
      navBar
      noChevron
      noPadding
      transparent={transparent}
    >
      <Flexbox direction="col" gap="2" className="p-3" alignContent="start">
        <CreateCubeButton>Create A New Cube</CreateCubeButton>
        <NavLink href="/packages/create">Create A New Package</NavLink>
      </Flexbox>
    </NavMenu>
  );

  const yourStuffMenu = user && (
    <NavMenu label="Your Stuff" navBar icon={<PackageIcon size={24} />} wide noChevron noGap transparent={transparent}>
      <Flexbox direction="col">
        <div
          className={classNames(
            'border-b border-border px-3 py-3 rounded-t-md',
            transparent ? 'bg-black/20' : 'bg-bg-active',
          )}
        >
          <Flexbox direction="col" gap="3">
            <Flexbox direction="col" gap="2">
              <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">Your Cubes</div>
              {(user.cubes || []).slice(0, 20).map((item) => (
                <NavLink key={`combined_cube_${item.name}`} href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}>
                  {item.name}
                </NavLink>
              ))}
            </Flexbox>

            {(user.collaboratingCubes || []).length > 0 && (
              <Flexbox direction="col" gap="2">
                <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">Collaborating</div>
                {(user.collaboratingCubes || []).slice(0, 12).map((item) => (
                  <NavLink
                    key={`combined_collab_${item.id}`}
                    href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}
                  >
                    {item.name}
                  </NavLink>
                ))}
              </Flexbox>
            )}
          </Flexbox>
        </div>

        <Flexbox direction="col" gap="3" className="p-3">
          <Flexbox direction="col" gap="2">
            <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">Actions</div>
            <CreateCubeButton>
              <span className="text-sm text-text-secondary hover:text-text">Create a new cube</span>
            </CreateCubeButton>
            <a href="/packages/create" className="text-sm text-text-secondary hover:text-text cursor-pointer">
              Create a new package
            </a>
          </Flexbox>
          <Flexbox direction="col" gap="2">
            <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">More</div>
            {(user.cubes || []).length > 2 && (
              <a href={`/user/view/${user.id}`} className="text-sm text-text-secondary hover:text-text cursor-pointer">
                View all my cubes
              </a>
            )}
            <a href={`/cube/liked/${user.id}`} className="text-sm text-text-secondary hover:text-text cursor-pointer">
              Liked cubes
            </a>
            <a href="/dashboard/drafts" className="text-sm text-text-secondary hover:text-text cursor-pointer">
              Drafts of your cubes
            </a>
            <a
              href={`/user/packages/${user.id}`}
              className="text-sm text-text-secondary hover:text-text cursor-pointer"
            >
              View all my packages
            </a>
            <a
              href={`/packages/liked/${user.id}`}
              className="text-sm text-text-secondary hover:text-text cursor-pointer"
            >
              Liked packages
            </a>
          </Flexbox>
        </Flexbox>
      </Flexbox>
    </NavMenu>
  );

  const userMenu = user && (
    <NavMenu label={<span className="whitespace-nowrap">{user.username}</span>} navBar transparent={transparent}>
      <Flexbox direction="col" gap="2" className="p-3">
        <NavLink href={`/user/view/${user.id}`}>Profile</NavLink>
        {user.roles && user.roles.includes(UserRoles.ADMIN) && <NavLink href="/admin/dashboard">Admin Page</NavLink>}
        {user.roles && user.roles.includes(UserRoles.CONTENT_CREATOR) && (
          <NavLink href="/content/creators">Content Creator Dashboard</NavLink>
        )}
        <NavLink href="/user/account">Settings</NavLink>
        <NavLink href="/user/logout">Logout</NavLink>
      </Flexbox>
    </NavMenu>
  );

  const guestNav = !user && (
    <>
      <LoginNavLink className={NAV_ITEM_CLASSES}>Login</LoginNavLink>
      <a href="/user/register" className={NAV_ITEM_CLASSES}>
        Register
      </a>
    </>
  );

  const resourcesLink = (
    <a href="/resources" className={NAV_ITEM_CLASSES}>
      <span className="lg:hidden">
        <ToolsIcon size={24} />
      </span>
      <span className="hidden lg:inline">Resources</span>
    </a>
  );

  const helpLink = (
    <a href="/help" className={NAV_ITEM_CLASSES}>
      <span className="lg:hidden">
        <QuestionIcon size={24} />
      </span>
      <span className="hidden lg:inline">Help</span>
    </a>
  );

  const leftNav = (
    <>
      {homeLink}
      {exploreMenu}
      {resourcesLink}
      {helpLink}
    </>
  );

  const rightNav = user ? (
    <>
      <NotificationsNav transparent={transparent} />
      {createMenu}
      <ResponsiveDiv lg>{yourCubesMenu}</ResponsiveDiv>
      <ResponsiveDiv lg>{yourPackagesMenu}</ResponsiveDiv>
      <ResponsiveDiv baseVisible lg>
        {yourStuffMenu}
      </ResponsiveDiv>
      {userMenu}
    </>
  ) : (
    guestNav
  );

  const mobileIconButton = (id: string, Icon: OcticonIcon, badge?: number) => {
    const isActive = mobileMenuOpen === id;
    return (
      <button
        key={id}
        onClick={() => toggleMobileMenu(id)}
        className={`px-2 py-1 rounded transition-colors duration-200 relative ${
          isActive ? 'bg-bg-active dark:text-white' : 'text-white'
        }`}
        style={isActive ? { color: 'var(--bg-secondary)' } : undefined}
      >
        {badge !== undefined && badge > 0 && (
          <span className="absolute top-0 right-0 text-xs font-semibold text-white bg-button-danger rounded-full px-1 py-0.5 min-w-[1.25rem] text-center translate-x-1 -translate-y-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        <Icon size={24} />
      </button>
    );
  };

  const mobileNavIcons = (
    <>
      {mobileIconButton('explore', SearchIcon)}
      <a href="/resources" className="px-2 py-1 rounded text-white" aria-label="Resources">
        <ToolsIcon size={24} />
      </a>
      <a href="/help" className="px-2 py-1 rounded text-white" aria-label="Help">
        <QuestionIcon size={24} />
      </a>
      {user && mobileIconButton('cubes', PackageIcon)}
      {user ? (
        <>
          {mobileIconButton('notifications', BellFillIcon, notifications.length)}
          {mobileIconButton('user', PersonIcon)}
        </>
      ) : (
        <>
          <MobileLoginButton className="px-2 py-1 rounded text-white" />
          <a href="/user/register" className="px-2 py-1 rounded text-white">
            <PersonAddIcon size={24} />
          </a>
        </>
      )}
    </>
  );

  return (
    <div className={classNames('px-6 py-2 relative', transparent ? 'nav-transparent' : 'bg-bg-secondary')}>
      {transparent && <div className="absolute inset-0 bg-bg-secondary/80 backdrop-blur-sm" />}
      <ResponsiveDiv baseVisible md className="w-full max-w-full relative">
        <Flexbox justify="between" alignItems="center" direction="row">
          <a href="/">
            <img
              className="h-10"
              src={cdnUrl('/content/sticker.png')}
              alt="Cube Cobra: a site for Magic: the Gathering Cube"
            />
          </a>
          {mobileNavIcons}
        </Flexbox>
      </ResponsiveDiv>

      <ResponsiveDiv md className="w-full max-w-full relative">
        <Flexbox justify="between" alignItems="center" direction="row" gap="4">
          <Flexbox alignItems="center" direction="row" gap="2">
            <a href="/">
              <img
                className="h-10"
                src={cdnUrl('/content/banner.png')}
                alt="Cube Cobra: a site for Magic: the Gathering Cube"
              />
            </a>
            <Flexbox alignItems="center" direction="row" gap="1">
              {leftNav}
            </Flexbox>
          </Flexbox>
          <Flexbox alignItems="center" direction="row" gap="2">
            {rightNav}
          </Flexbox>
        </Flexbox>
      </ResponsiveDiv>

      {/* Mobile Menu Dropdown */}
      <ResponsiveDiv baseVisible md>
        {mobileMenuOpen === 'explore' && (
          <div
            className={classNames(
              'mt-3 p-4 rounded',
              transparent ? 'bg-bg-secondary/80 backdrop-blur-sm text-button-text' : 'bg-bg-active',
            )}
          >
            <Flexbox direction="col" gap="3">
              {exploreSections.map((section, idx) => (
                <Flexbox direction="col" gap="2" key={section.header || `mobile-section-${idx}`}>
                  {section.header && (
                    <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">
                      {section.header}
                    </div>
                  )}
                  {section.items.map(renderSubItem)}
                </Flexbox>
              ))}
            </Flexbox>
          </div>
        )}
        {mobileMenuOpen === 'notifications' && user && (
          <div
            className={classNames(
              'mt-3 rounded',
              transparent ? 'bg-bg-secondary/80 backdrop-blur-sm text-button-text' : 'bg-bg-active',
            )}
          >
            <Flexbox direction="col">
              <CardHeader>
                <Flexbox justify="between" direction="row" className="font-semibold">
                  Notifications
                  <Link className="card-subtitle float-end mt-0" onClick={clearNotifications}>
                    Clear All
                  </Link>
                </Flexbox>
              </CardHeader>
              <Flexbox direction="col" className="max-h-96 overflow-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <a
                      className="py-3 px-2 hover:bg-bg-active hover:cursor-pointer"
                      href={`/user/notification/${notification.id}`}
                      key={notification.id}
                    >
                      {notification.body}
                    </a>
                  ))
                ) : (
                  <div className="my-2">
                    <em className="mx-4">You don't have any notifications to show.</em>
                  </div>
                )}
              </Flexbox>
              <CardFooter className="pb-1 pt-1 font-semibold">
                <Link href="/user/notifications">View Older Notifications</Link>
              </CardFooter>
            </Flexbox>
          </div>
        )}
        {mobileMenuOpen === 'cubes' && user && (
          <div
            className={classNames(
              'mt-3 rounded overflow-hidden',
              transparent ? 'bg-bg-secondary/80 backdrop-blur-sm text-button-text' : 'bg-bg-active',
            )}
          >
            <Flexbox direction="col">
              <div className={classNames('border-b border-border px-4 py-3', transparent ? 'bg-black/20' : 'bg-bg')}>
                <Flexbox direction="col" gap="3">
                  <Flexbox direction="col" gap="2">
                    <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">Your Cubes</div>
                    {(user.cubes || []).slice(0, 20).map((item) => (
                      <NavLink
                        key={`mobile_cube_${item.name}`}
                        href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}
                      >
                        {item.name}
                      </NavLink>
                    ))}
                  </Flexbox>

                  {(user.collaboratingCubes || []).length > 0 && (
                    <Flexbox direction="col" gap="2">
                      <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">Collaborating</div>
                      {(user.collaboratingCubes || []).slice(0, 12).map((item) => (
                        <NavLink
                          key={`mobile_collab_${item.id}`}
                          href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}
                        >
                          {item.name}
                        </NavLink>
                      ))}
                    </Flexbox>
                  )}
                </Flexbox>
              </div>

              <Flexbox direction="col" gap="3" className="p-4">
                <Flexbox direction="col" gap="2">
                  <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">Actions</div>
                  <CreateCubeButton>
                    <span className="text-sm text-text-secondary hover:text-text">Create a new cube</span>
                  </CreateCubeButton>
                  <a href="/packages/create" className="text-sm text-text-secondary hover:text-text cursor-pointer">
                    Create a new package
                  </a>
                </Flexbox>
                <Flexbox direction="col" gap="2">
                  <div className="text-xs uppercase font-bold text-text-secondary tracking-wide">More</div>
                  {(user.cubes || []).length > 2 && (
                    <a
                      href={`/user/view/${user.id}`}
                      className="text-sm text-text-secondary hover:text-text cursor-pointer"
                    >
                      View all my cubes
                    </a>
                  )}
                  <a
                    href={`/cube/liked/${user.id}`}
                    className="text-sm text-text-secondary hover:text-text cursor-pointer"
                  >
                    Liked cubes
                  </a>
                  <a href="/dashboard/drafts" className="text-sm text-text-secondary hover:text-text cursor-pointer">
                    Drafts of your cubes
                  </a>
                  <a
                    href={`/user/packages/${user.id}`}
                    className="text-sm text-text-secondary hover:text-text cursor-pointer"
                  >
                    View all my packages
                  </a>
                  <a
                    href={`/packages/liked/${user.id}`}
                    className="text-sm text-text-secondary hover:text-text cursor-pointer"
                  >
                    Liked packages
                  </a>
                </Flexbox>
              </Flexbox>
            </Flexbox>
          </div>
        )}
        {mobileMenuOpen === 'user' && user && (
          <div
            className={classNames(
              'mt-3 p-4 rounded',
              transparent ? 'bg-bg-secondary/80 backdrop-blur-sm text-button-text' : 'bg-bg-active',
            )}
          >
            <Flexbox direction="col" gap="2">
              <NavLink href={`/user/view/${user.id}`}>Profile</NavLink>
              {user.roles && user.roles.includes(UserRoles.ADMIN) && (
                <NavLink href="/admin/dashboard">Admin Page</NavLink>
              )}
              {user.roles && user.roles.includes(UserRoles.CONTENT_CREATOR) && (
                <NavLink href="/content/creators">Content Creator Dashboard</NavLink>
              )}
              <NavLink href="/user/account">Settings</NavLink>
              <NavLink href="/user/logout">Logout</NavLink>
            </Flexbox>
          </div>
        )}
      </ResponsiveDiv>
    </div>
  );
};

export default Navbar;
