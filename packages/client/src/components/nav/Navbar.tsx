import React, { useContext, useEffect, useState } from 'react';

import type { Icon as OcticonIcon } from '@primer/octicons-react';
import {
  BookIcon,
  ClockIcon,
  FeedPlusIcon,
  GraphIcon,
  HomeIcon,
  PackageIcon,
  QuestionIcon,
  SearchIcon,
  ShareAndroidIcon,
  StackIcon,
  StarIcon,
  TableIcon,
  ToolsIcon,
  TypographyIcon,
  VersionsIcon,
  ListOrderedIcon,
} from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import { UserRoles } from '@utils/datatypes/User';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import UserContext from '../../contexts/UserContext';
import { CardFooter } from '../base/Card';
import { Flexbox } from '../base/Layout';
import NavButton from '../base/NavButton';
import NavLink from '../base/NavLink';
import NavMenu from '../base/NavMenu';
import PostButton from '../base/PostButton';
import ResponsiveDiv from '../base/ResponsiveDiv';
import LoginModal from '../modals/LoginModal';
import withQuickCreateCube from '../QuickCreateCubeButton';
import withModal from '../WithModal';
import MobileNav from './MobileNav';
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

// Logging out is a POST, so it is a form button made to look like the NavLinks around it.
const LogoutNavLink: React.FC = () => (
  <PostButton
    action="/user/logout"
    unstyled
    className="w-full text-left select-none font-normal transition-colors duration-200 ease-in-out text-text hover:text-text-secondary"
  >
    Logout
  </PostButton>
);

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
      { label: 'Sets', href: '/tool/sets', icon: StackIcon },
      { label: 'Packages', href: '/packages', icon: VersionsIcon },
    ],
  },
  {
    header: 'Dailies',
    items: [
      { label: 'Mana Matrix', href: '/tool/manamatrix', icon: TableIcon },
      { label: 'Synergy Connect', href: '/tool/synergyconnect', icon: ShareAndroidIcon },
      { label: 'Crossword', href: '/tool/crossword', icon: TypographyIcon },
      { label: 'Daily P1P1', href: '/tool/p1p1/daily', icon: ListOrderedIcon },
    ],
  },
];

interface NavbarProps {
  transparent?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ transparent = false }) => {
  const user = useContext(UserContext);
  const [pathname, setPathname] = useState<string | null>(null);

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const isHomePage = pathname === '/landing' || pathname === '/dashboard';

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
        <LogoutNavLink />
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

  const wikiLink = (
    <a href="/wiki" className={NAV_ITEM_CLASSES}>
      <span className="lg:hidden">
        <BookIcon size={24} />
      </span>
      <span className="hidden lg:inline">Wiki</span>
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
      {wikiLink}
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

  return (
    <div className={classNames('px-6 py-2 relative', transparent ? 'nav-transparent' : 'bg-bg-secondary')}>
      {transparent && <div className="absolute inset-0 bg-bg-secondary/80 backdrop-blur-sm" />}
      <ResponsiveDiv baseVisible md className="w-full max-w-full relative">
        <MobileNav />
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
    </div>
  );
};

export default Navbar;
