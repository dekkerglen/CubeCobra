import React, { useContext } from 'react';

import { ChevronUpIcon, ThreeBarsIcon } from '@primer/octicons-react';

import { CardFooter } from 'components/base/Card';
import NavButton from 'components/base/NavButton';
import CardSearchBar from 'components/card/CardSearchBar';
import LoginModal from 'components/modals/LoginModal';
import UserContext from 'contexts/UserContext';
import Button from '../base/Button';
import Collapse from '../base/Collapse';
import Container from '../base/Container';
import { Flexbox } from '../base/Layout';
import NavLink from '../base/NavLink';
import NavMenu from '../base/NavMenu';
import ResponsiveDiv from '../base/ResponsiveDiv';
import NotificationsNav from './NotificationsNav';
import CreateCubeModal from 'components/modals/CreateCubeModal';

import withModal from 'components/WithModal';

const LoginButton = withModal(NavButton, LoginModal);
const CreateCubeButton = withModal(NavButton, CreateCubeModal);

const navItems = [
  {
    title: 'Content',
    items: [
      { label: 'Browse', href: '/content/browse' },
      { label: 'Articles', href: '/content/articles' },
      { label: 'Podcasts', href: '/content/podcasts' },
      { label: 'Videos', href: '/content/videos' },
    ],
  },
  {
    title: 'Cube',
    items: [
      { label: 'Explore cubes', href: '/explore' },
      { label: 'Search cubes', href: '/search' },
    ],
  },
  {
    title: 'Cards',
    items: [
      { label: 'Top Cards', href: '/tool/topcards' },
      { label: 'Search Cards', href: '/tool/searchcards' },
      { label: 'Packages', href: '/packages' },
      { label: 'Filter Syntax', href: '/filters' },
    ],
  },
  {
    title: 'About',
    items: [
      { label: 'Dev Blog', href: '/dev/blog' },
      { label: 'Contact', href: '/contact' },
      {
        label: 'Merchandise',
        href: 'https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372',
      },
      { label: 'Donate', href: '/donate' },
      { label: 'Github', href: 'https://github.com/dekkerglen/CubeCobra' },
    ],
  },
];

type NavbarProps = {
  expanded: boolean;
  toggle: () => void;
  loginCallback?: string;
};

const Navbar: React.FC<NavbarProps> = ({ toggle, expanded }) => {
  const user = useContext(UserContext);

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
              {(user.cubes || []).map((item) => (
                <NavLink key={`dropdown_cube_${item.name}`} href={`/cube/overview/${item.id}`}>
                  {item.name}
                </NavLink>
              ))}
            </Flexbox>
            <CardFooter>
              <CreateCubeButton>Create A New Cube</CreateCubeButton>
            </CardFooter>
          </NavMenu>
          <NavMenu label={user.username} navBar>
            <Flexbox direction="col" gap="2" className="p-3">
              <NavLink href={`/user/view/${user.id}`}>Your Profile</NavLink>
              {user.roles && user.roles.includes('Admin') && <NavLink href="/admin/dashboard">Admin Page</NavLink>}
              {user.roles && user.roles.includes('ContentCreator') && (
                <NavLink href="/content/creators">Content Creator Dashboard</NavLink>
              )}
              <CreateCubeButton>Create A New Cube</CreateCubeButton>
              <NavLink href="/user/social">Social</NavLink>
              <NavLink href="/user/account">Account Information</NavLink>
              <NavLink href="/user/logout">Logout</NavLink>
            </Flexbox>
          </NavMenu>
        </>
      ) : (
        <>
          <NavLink root href="/user/register">
            Register
          </NavLink>
          <LoginButton root>Login</LoginButton>
        </>
      )}
    </>
  );

  return (
    <div className="bg-bg-secondary p-3">
      <Container xxl>
        <Flexbox direction="col">
          <Flexbox justify="between" alignItems="center" direction="row" gap="4">
            <a href="/">
              <img
                className="h-10"
                src="/content/banner.png"
                alt="Cube Cobra: a site for Magic: the Gathering Cubing"
              />
            </a>
            <ResponsiveDiv baseVisible lg>
              <Button color="secondary" onClick={toggle}>
                {expanded ? <ChevronUpIcon size={32} /> : <ThreeBarsIcon size={32} />}
              </Button>
            </ResponsiveDiv>
            <ResponsiveDiv xl className="flex-grow">
              <CardSearchBar />
            </ResponsiveDiv>
            <ResponsiveDiv lg>
              <Flexbox alignContent="end" direction="row" gap="2" className="height-auto">
                {navs}
              </Flexbox>
            </ResponsiveDiv>
          </Flexbox>
          <ResponsiveDiv baseVisible lg>
            <Collapse isOpen={expanded}>
              <Flexbox direction="col" gap="2">
                {navs}
              </Flexbox>
            </Collapse>
          </ResponsiveDiv>
        </Flexbox>
      </Container>
    </div>
  );
};

export default Navbar;
