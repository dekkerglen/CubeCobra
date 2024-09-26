import React, { useContext } from 'react';
import {
  Collapse,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  Navbar,
  NavbarBrand,
  NavbarToggler,
  NavItem,
  NavLink,
  UncontrolledDropdown,
} from 'reactstrap';

import CardSearchBar from 'components/CardSearchBar';
import CreateCubeModal from 'components/CreateCubeModal';
import ErrorBoundary from 'components/ErrorBoundary';
import LoginModal from 'components/LoginModal';
import MobileBanner from 'components/MobileBanner';
import NotificationsNav from 'components/NotificationsNav';
import SideBanner from 'components/SideBanner';
import withModal from 'components/WithModal';
import ThemeContext from 'contexts/ThemeContext';
import UserContext from 'contexts/UserContext';
import useToggle from 'hooks/UseToggle';
import Footer from 'layouts/Footer';

const LoginModalLink = withModal(NavLink, LoginModal);

const CreateCubeModalLink = withModal(DropdownItem, CreateCubeModal);

interface MainLayoutProps {
  children: React.ReactNode;
  loginCallback?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, loginCallback = '/' }) => {
  const user = useContext(UserContext);
  const [expanded, toggle] = useToggle(false);
  return (
    <div className="flex-container flex-vertical viewport">
      <Navbar color="dark" expand="md" dark className="py-0 px-4">
        <NavbarBrand href="/" className="overflow-hidden">
          <img
            className="banner-image"
            src="/content/banner.png"
            alt="Cube Cobra: a site for Magic: the Gathering Cubing"
          />
        </NavbarBrand>
        <div className="d-none d-xl-block mx-4">
          <CardSearchBar />
        </div>
        <NavbarToggler onClick={toggle} />
        <Collapse isOpen={expanded} navbar>
          <Nav className="ms-auto" navbar>
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                Content
              </DropdownToggle>
              <DropdownMenu end>
                <DropdownItem href="/content/browse">Browse</DropdownItem>
                <DropdownItem href="/content/articles">Articles</DropdownItem>
                <DropdownItem href="/content/podcasts">Podcasts</DropdownItem>
                <DropdownItem href="/content/videos">Videos</DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                Cube
              </DropdownToggle>
              <DropdownMenu end>
                <DropdownItem href="/explore">Explore cubes</DropdownItem>
                <DropdownItem href="/search">Search cubes</DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                Cards
              </DropdownToggle>
              <DropdownMenu end>
                <DropdownItem href="/tool/topcards">Top Cards</DropdownItem>
                <DropdownItem href="/tool/searchcards">Search Cards</DropdownItem>
                <DropdownItem href="/packages/browse">Packages</DropdownItem>
                <DropdownItem href="/filters">Filter Syntax</DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                About
              </DropdownToggle>
              <DropdownMenu end>
                <DropdownItem href="/dev/blog">Dev Blog</DropdownItem>
                <DropdownItem href="/contact">Contact</DropdownItem>
                <DropdownItem href="https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
                  Merchandise
                </DropdownItem>
                <DropdownItem href="/donate">Donate</DropdownItem>
                <DropdownItem href="https://github.com/dekkerglen/CubeCobra">Github</DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            {user ? (
              <>
                <NotificationsNav />
                {user.cubes && user.cubes.length > 0 && (
                  <UncontrolledDropdown nav inNavbar>
                    <DropdownToggle nav caret>
                      Your Cubes
                    </DropdownToggle>
                    <DropdownMenu end>
                      {user.cubes.map((item) => (
                        <DropdownItem key={`dropdown_cube_${item.name}`} href={`/cube/overview/${item.id}`}>
                          {item.name}
                        </DropdownItem>
                      ))}
                      <DropdownItem divider />
                      <CreateCubeModalLink>Create A New Cube</CreateCubeModalLink>
                    </DropdownMenu>
                  </UncontrolledDropdown>
                )}
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret>
                    {user.username}
                  </DropdownToggle>
                  <DropdownMenu end>
                    <DropdownItem href={`/user/view/${user.id}`}>Your Profile</DropdownItem>
                    {user.roles && user.roles.includes('Admin') && (
                      <DropdownItem href="/admin/dashboard">Admin Page</DropdownItem>
                    )}
                    {user.roles && user.roles.includes('ContentCreator') && (
                      <DropdownItem href="/content/creators">Content Creator Dashboard</DropdownItem>
                    )}
                    <CreateCubeModalLink>Create A New Cube</CreateCubeModalLink>
                    <DropdownItem href="/user/social">Social</DropdownItem>
                    <DropdownItem href="/user/account">Account Information</DropdownItem>
                    <DropdownItem href="/user/logout">Logout</DropdownItem>
                  </DropdownMenu>
                </UncontrolledDropdown>
              </>
            ) : (
              <>
                <NavItem>
                  <NavLink href="/user/register">Register</NavLink>
                </NavItem>
                <NavItem>
                  <LoginModalLink modalProps={{ loginCallback }}>Login</LoginModalLink>
                </NavItem>
              </>
            )}
          </Nav>
        </Collapse>
      </Navbar>

      <div className="d-flex flex-row flex-grow flex-grow">
        <div className="d-none d-lg-block mx-4">
          <SideBanner placementId="left-rail-1" />
          <SideBanner placementId="left-rail-2" />
        </div>
        <div className="main-content flex-grow max-width  mx-4">
          <ThemeContext.Provider value={user?.theme ?? 'default'}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </ThemeContext.Provider>
        </div>
        <div className="d-none d-lg-block mx-4">
          <SideBanner placementId="right-rail-1" />
          <SideBanner placementId="right-rail-2" />
        </div>
        <div className="d-lg-none">
          <MobileBanner placementId="mobile-banner" />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MainLayout;
