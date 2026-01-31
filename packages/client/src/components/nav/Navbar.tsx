import React, { useContext, useState } from 'react';

import { BellFillIcon, BookIcon, InfoIcon, PackageIcon, PersonIcon, SearchIcon } from '@primer/octicons-react';
import Notification from '@utils/datatypes/Notification';
import { UserRoles } from '@utils/datatypes/User';
import { getCubeId } from '@utils/Util';

import { CSRFContext } from '../../contexts/CSRFContext';
import UserContext from '../../contexts/UserContext';
import { CardFooter, CardHeader } from '../base/Card';
import Container from '../base/Container';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import NavButton from '../base/NavButton';
import NavLink from '../base/NavLink';
import NavMenu from '../base/NavMenu';
import ResponsiveDiv from '../base/ResponsiveDiv';
import CardSearchBar from '../card/CardSearchBar';
import CreateCubeModal from '../modals/CreateCubeModal';
import LoginModal from '../modals/LoginModal';
import withModal from '../WithModal';
import NotificationsNav from './NotificationsNav';

const LoginButton = withModal(NavButton, LoginModal);
const CreateCubeButton = withModal(NavButton, CreateCubeModal);

const navItems = [
  {
    title: 'Content',
    items: [
      { label: 'Browse Content', href: '/content/browse' },
      { label: 'Articles', href: '/content/articles' },
      { label: 'Podcasts', href: '/content/podcasts' },
      { label: 'Videos', href: '/content/videos' },
    ],
  },
  {
    title: 'Explore',
    items: [
      { label: 'Explore cubes', href: '/explore' },
      { label: 'Search cubes', href: '/search' },
      { label: 'Featured queue', href: '/queue' },
      { label: 'Top Cards', href: '/tool/topcards' },
      { label: 'Search Cards', href: '/tool/searchcards' },
      { label: 'Packages', href: '/packages' },
    ],
  },
  {
    title: 'About',
    items: [
      { label: 'Dev Blog', href: '/dev/blog' },
      { label: 'Contact', href: '/contact' },
      // {
      //   label: 'Merchandise',
      //   href: '/merchandise',
      // },
      { label: 'Donate', href: '/donate' },
      { label: 'Github', href: 'https://github.com/dekkerglen/CubeCobra' },
      { label: 'Filter Syntax', href: '/filters' },
      { label: 'Card Updates', href: '/tool/cardupdates' },
    ],
  },
];

type NavbarProps = Record<string, never>;

const Navbar: React.FC<NavbarProps> = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(user?.notifications || []);

  const toggleMobileMenu = (menuId: string) => {
    setMobileMenuOpen(mobileMenuOpen === menuId ? null : menuId);
  };

  const clearNotifications = async () => {
    await csrfFetch('/user/clearnotifications', {
      method: 'POST',
    });
    setNotifications([]);
  };

  const navs = (
    <>
      {navItems.map((item) => (
        <NavMenu key={item.title} label={item.title} navBar>
          <Flexbox direction="col" gap="2" className="p-3">
            {item.items.map((subItem) => (
              <NavLink key={subItem.label} href={subItem.href}>
                {subItem.label}
              </NavLink>
            ))}
          </Flexbox>
        </NavMenu>
      ))}
      {user ? (
        <>
          <NotificationsNav />
          <NavMenu label="Your Cubes" navBar>
            <Flexbox direction="col" gap="1" className="max-h-96 overflow-auto p-2">
              {(user.cubes || []).slice(0, 36).map((item) => (
                <NavLink key={`dropdown_cube_${item.name}`} href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}>
                  {item.name}
                </NavLink>
              ))}
            </Flexbox>
            <CardFooter>
              <Flexbox direction="col" gap="2">
                {(user.cubes || []).length > 2 && <NavLink href={`/user/view/${user.id}`}>View All</NavLink>}
                <CreateCubeButton>Create A New Cube</CreateCubeButton>
              </Flexbox>
            </CardFooter>
          </NavMenu>
          <NavMenu label={user.username} navBar>
            <Flexbox direction="col" gap="2" className="p-3">
              <NavLink href={`/user/view/${user.id}`}>Your Profile</NavLink>
              {user.roles && user.roles.includes(UserRoles.ADMIN) && (
                <NavLink href="/admin/dashboard">Admin Page</NavLink>
              )}
              {user.roles && user.roles.includes(UserRoles.CONTENT_CREATOR) && (
                <NavLink href="/content/creators">Content Creator Dashboard</NavLink>
              )}
              <CreateCubeButton>Create A New Cube</CreateCubeButton>
              <NavLink href="/user/social">Followed and Followers</NavLink>
              <NavLink href="/user/account">Account Information</NavLink>
              <NavLink href="/user/logout">Logout</NavLink>
            </Flexbox>
          </NavMenu>
        </>
      ) : (
        <>
          <NavMenu label="Account" navBar>
            <Flexbox direction="col" gap="2" className="p-3">
              <NavLink href="/user/register">Create Account</NavLink>
              <LoginButton>Login</LoginButton>
            </Flexbox>
          </NavMenu>
        </>
      )}
    </>
  );

  const mobileNavIcons = (
    <>
      <button
        onClick={() => toggleMobileMenu('content')}
        className={`px-2 py-1 rounded transition-colors duration-200 text-white ${mobileMenuOpen === 'content' ? 'bg-bg-active' : ''}`}
      >
        <BookIcon size={24} />
      </button>
      <button
        onClick={() => toggleMobileMenu('explore')}
        className={`px-2 py-1 rounded transition-colors duration-200 text-white ${mobileMenuOpen === 'explore' ? 'bg-bg-active' : ''}`}
      >
        <SearchIcon size={24} />
      </button>
      <button
        onClick={() => toggleMobileMenu('about')}
        className={`px-2 py-1 rounded transition-colors duration-200 text-white ${mobileMenuOpen === 'about' ? 'bg-bg-active' : ''}`}
      >
        <InfoIcon size={24} />
      </button>
      {user ? (
        <>
          <button
            onClick={() => toggleMobileMenu('notifications')}
            className={`px-2 py-1 rounded transition-colors duration-200 text-white relative ${mobileMenuOpen === 'notifications' ? 'bg-bg-active' : ''}`}
          >
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 text-xs font-semibold text-white bg-button-danger rounded-full px-1 py-0.5 min-w-[1.25rem] text-center translate-x-1 -translate-y-1">
                {notifications.length > 99 ? '99+' : notifications.length}
              </span>
            )}
            <BellFillIcon size={24} />
          </button>
          <button
            onClick={() => toggleMobileMenu('cubes')}
            className={`px-2 py-1 rounded transition-colors duration-200 text-white ${mobileMenuOpen === 'cubes' ? 'bg-bg-active' : ''}`}
          >
            <PackageIcon size={24} />
          </button>
          <button
            onClick={() => toggleMobileMenu('user')}
            className={`px-2 py-1 rounded transition-colors duration-200 text-white ${mobileMenuOpen === 'user' ? 'bg-bg-active' : ''}`}
          >
            <PersonIcon size={24} />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => toggleMobileMenu('account')}
            className={`px-2 py-1 rounded transition-colors duration-200 text-white ${mobileMenuOpen === 'account' ? 'bg-bg-active' : ''}`}
          >
            <PersonIcon size={24} />
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="bg-bg-secondary px-3 py-2">
      <Container xxl>
        <Flexbox direction="col">
          <Flexbox justify="between" alignItems="center" direction="row" gap="4">
            <ResponsiveDiv baseVisible md className="w-full max-w-full">
              <Flexbox justify="between" alignItems="center" direction="row">
                <a href="/">
                  <img
                    className="h-8"
                    src="/content/sticker.png"
                    alt="Cube Cobra: a site for Magic: the Gathering Cubing"
                  />
                </a>
                {mobileNavIcons}
              </Flexbox>
            </ResponsiveDiv>
            <a href="/" className="hidden md:block lg:hidden">
              <img
                className="h-8"
                src="/content/sticker.png"
                alt="Cube Cobra: a site for Magic: the Gathering Cubing"
              />
            </a>
            <ResponsiveDiv lg>
              <a href="/">
                <img
                  className="h-10"
                  src="/content/banner.png"
                  alt="Cube Cobra: a site for Magic: the Gathering Cubing"
                />
              </a>
            </ResponsiveDiv>
            <ResponsiveDiv xl className="flex-grow">
              <CardSearchBar />
            </ResponsiveDiv>
            <ResponsiveDiv md>
              <Flexbox alignContent="end" direction="row" gap="2" className="height-auto">
                {navs}
              </Flexbox>
            </ResponsiveDiv>
          </Flexbox>
          {/* Mobile Menu Dropdown */}
          <ResponsiveDiv baseVisible md>
            {mobileMenuOpen === 'content' && (
              <div className="bg-bg-active mt-3 p-4 rounded">
                <Flexbox direction="col" gap="2">
                  {navItems[0].items.map((subItem) => (
                    <NavLink key={subItem.label} href={subItem.href}>
                      {subItem.label}
                    </NavLink>
                  ))}
                </Flexbox>
              </div>
            )}
            {mobileMenuOpen === 'explore' && (
              <div className="bg-bg-active mt-3 p-4 rounded">
                <Flexbox direction="col" gap="2">
                  {navItems[1].items.map((subItem) => (
                    <NavLink key={subItem.label} href={subItem.href}>
                      {subItem.label}
                    </NavLink>
                  ))}
                </Flexbox>
              </div>
            )}
            {mobileMenuOpen === 'about' && (
              <div className="bg-bg-active mt-3 p-4 rounded">
                <Flexbox direction="col" gap="2">
                  {navItems[2].items.map((subItem) => (
                    <NavLink key={subItem.label} href={subItem.href}>
                      {subItem.label}
                    </NavLink>
                  ))}
                </Flexbox>
              </div>
            )}
            {mobileMenuOpen === 'notifications' && user && (
              <div className="bg-bg-active mt-3 rounded">
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
              <div className="bg-bg-active mt-3 rounded">
                <Flexbox direction="col">
                  <CardHeader className="font-semibold">Your Cubes</CardHeader>
                  <Flexbox direction="col" gap="1" className="max-h-96 overflow-auto p-2">
                    {(user.cubes || []).slice(0, 36).map((item) => (
                      <NavLink
                        key={`mobile_cube_${item.name}`}
                        href={`/cube/list/${encodeURIComponent(getCubeId(item))}`}
                      >
                        {item.name}
                      </NavLink>
                    ))}
                  </Flexbox>
                  <CardFooter>
                    <Flexbox direction="col" gap="2">
                      {(user.cubes || []).length > 2 && <NavLink href={`/user/view/${user.id}`}>View All</NavLink>}
                      <CreateCubeButton>Create A New Cube</CreateCubeButton>
                    </Flexbox>
                  </CardFooter>
                </Flexbox>
              </div>
            )}
            {mobileMenuOpen === 'user' && user && (
              <div className="bg-bg-active mt-3 p-4 rounded">
                <Flexbox direction="col" gap="2">
                  <NavLink href={`/user/view/${user.id}`}>Your Profile</NavLink>
                  <NavLink href="/user/social">Followed and Followers</NavLink>
                  <NavLink href="/user/account">Account Information</NavLink>
                  <NavLink href="/user/logout">Logout</NavLink>
                </Flexbox>
              </div>
            )}
            {mobileMenuOpen === 'account' && !user && (
              <div className="bg-bg-active mt-3 p-4 rounded">
                <Flexbox direction="col" gap="2">
                  <NavLink href="/user/register">Create Account</NavLink>
                  <LoginButton>Login</LoginButton>
                </Flexbox>
              </div>
            )}
          </ResponsiveDiv>
        </Flexbox>
      </Container>
    </div>
  );
};

export default Navbar;
