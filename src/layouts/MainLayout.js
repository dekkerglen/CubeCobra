import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import {
  Container,
  Collapse,
  Nav,
  Navbar,
  NavItem,
  NavLink,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownItem,
  DropdownMenu,
  NavbarBrand,
  NavbarToggler,
} from 'reactstrap';

import UserContext from 'contexts/UserContext';
import ErrorBoundary from 'components/ErrorBoundary';
import LoginModal from 'components/LoginModal';
import CreateCubeModal from 'components/CreateCubeModal';
import withModal from 'components/WithModal';
import NotificationsNav from 'components/NotificationsNav';
import SideBanner from 'components/SideBanner';
import MobileBanner from 'components/MobileBanner';
import ThemeContext from 'contexts/ThemeContext';
import useToggle from 'hooks/UseToggle';
import Footer from 'layouts/Footer';

const LoginModalLink = withModal(NavLink, LoginModal);
const CreateCubeModalLink = withModal(DropdownItem, CreateCubeModal);

const MainLayout = ({ children, loginCallback }) => {
  const user = useContext(UserContext);
  const [expanded, toggle] = useToggle(false);
  return (
    <div className="flex-container flex-vertical viewport">
      <Navbar color="dark" expand="md" container="xl" dark className="my-0">
        <NavbarBrand href="/" className="overflow-hidden">
          <img
            className="banner-image"
            src="/content/banner.png"
            alt="Cube Cobra: a site for Magic: the Gathering Cubing"
          />
        </NavbarBrand>
        <NavbarToggler className="me-1" onClick={toggle} />
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
                <DropdownItem href="/explore">Explore Cubes</DropdownItem>
                <DropdownItem href="/search">Search Cubes</DropdownItem>
                <DropdownItem href="/random">Random Cube</DropdownItem>
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
                <DropdownItem href="/tool/randomcard">Random Card</DropdownItem>
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
                <DropdownItem href="/ourstory">Our Story</DropdownItem>
                <DropdownItem href="/faq">FAQ</DropdownItem>
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
                        <DropdownItem key={`dropdown_cube_${item.Name}`} href={`/cube/overview/${item.Id}`}>
                          {item.Name}
                        </DropdownItem>
                      ))}
                      <DropdownItem divider />
                      <CreateCubeModalLink>Create A New Cube</CreateCubeModalLink>
                    </DropdownMenu>
                  </UncontrolledDropdown>
                )}
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret>
                    {user.Username}
                  </DropdownToggle>
                  <DropdownMenu end>
                    <DropdownItem href={`/user/view/${user.Id}`}>Your Profile</DropdownItem>
                    {user.Roles && user.Roles.includes('Admin') && (
                      <DropdownItem href="/admin/dashboard">Admin Page</DropdownItem>
                    )}
                    {user.Roles && user.Roles.includes('ContentCreator') && (
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

      <Container fluid="xl" className="flex-grow main-content">
        <ThemeContext.Provider value={user?.theme ?? 'default'}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </ThemeContext.Provider>
        <div className="d-lg-none">
          <MobileBanner placementId="mobile-banner" />
        </div>
        <div className="ad-left d-none d-lg-block">
          <SideBanner placementId="left-rail" side="left" />
        </div>
        <div className="ad-right d-none d-lg-block">
          <SideBanner placementId="right-rail" side="right" />
        </div>
      </Container>
      <Footer />
    </div>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
  loginCallback: PropTypes.string,
};

MainLayout.defaultProps = {
  loginCallback: '/',
};

export default MainLayout;
