import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

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
} from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';
import LoginModal from 'components/LoginModal';
import CreateCubeModal from 'components/CreateCubeModal';
import withModal from 'components/WithModal';
import NotificationsNav from 'components/NotificationsNav';
import ThemeContext from 'contexts/ThemeContext';
import UserContext from 'contexts/UserContext';
import useToggle from 'hooks/UseToggle';
import Footer from 'layouts/Footer';

const LoginModalLink = withModal(NavLink, LoginModal);
const CreateCubeModalLink = withModal(DropdownItem, CreateCubeModal);

const MainLayout = ({ user, children, loginCallback }) => {
  const [expanded, toggle] = useToggle(false);

  return (
    <UserContext.Provider value={user}>
      <div className="flex-container flex-vertical viewport">
        <Navbar color="dark" expand="md" dark>
          <Container fluid="xl">
            <div className="d-flex flex-nowrap w-100 header-banner">
              <div className="overflow-hidden mr-auto">
                <a href="/">
                  <img
                    className="banner-image"
                    src="/content/banner.png"
                    alt="Cube Cobra: a site for Magic: the Gathering Cubing"
                  />
                </a>
              </div>
              <button className="navbar-toggler" type="button" onClick={toggle}>
                <span className="navbar-toggler-icon" />
              </button>
            </div>
            <Collapse className="banner-collapse" isOpen={expanded} navbar>
              <Nav className="mr-auto" navbar>
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret>
                    Content
                  </DropdownToggle>
                  <DropdownMenu right>
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
                  <DropdownMenu right>
                    <DropdownItem href="/explore">Explore Cubes</DropdownItem>
                    <DropdownItem href="/search">Search Cubes</DropdownItem>
                    <DropdownItem href="/random">Random Cube</DropdownItem>
                  </DropdownMenu>
                </UncontrolledDropdown>
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret>
                    Cards
                  </DropdownToggle>
                  <DropdownMenu right>
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
                  <DropdownMenu right>
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
                        <DropdownMenu right>
                          {user.cubes.map((item) => (
                            <DropdownItem key={`dropdown_cube_${item.name}`} href={`/cube/overview/${item._id}`}>
                              {item.name}
                            </DropdownItem>
                          ))}
                        </DropdownMenu>
                      </UncontrolledDropdown>
                    )}
                    <UncontrolledDropdown nav inNavbar>
                      <DropdownToggle nav caret>
                        {user.username}
                      </DropdownToggle>
                      <DropdownMenu right>
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
          </Container>
        </Navbar>
        <Container fluid="xl" className="flex-grow">
          <ThemeContext.Provider value={user?.theme ?? 'default'}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </ThemeContext.Provider>
        </Container>
        <Footer />
      </div>
    </UserContext.Provider>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

MainLayout.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default MainLayout;
