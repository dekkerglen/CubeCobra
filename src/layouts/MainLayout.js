import React from 'react';
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
} from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';
import LoginModal from 'components/LoginModal';
import CreateCubeModal from 'components/CreateCubeModal';
import withModal from 'components/WithModal';
import NotificationsNav from 'components/NotificationsNav';
import useToggle from 'hooks/UseToggle';
import Footer from 'layouts/Footer';

const LoginModalLink = withModal(NavLink, LoginModal);
const CreateCubeModalLink = withModal(DropdownItem, CreateCubeModal);

const MainLayout = ({ user, children }) => {
  const [expanded, toggle] = useToggle(false);

  return (
    <div className="flex-container flex-vertical viewport">
      <Navbar color="dark" expand="md" dark>
        <Container>
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
                  Browse
                </DropdownToggle>
                <DropdownMenu right>
                  <DropdownItem href="/tool/topcards">Top Cards</DropdownItem>
                  <DropdownItem href="/tool/searchcards">Search Cards</DropdownItem>
                  <DropdownItem href="/explore">Explore Cubes</DropdownItem>
                  <DropdownItem href="/search">Search Cubes</DropdownItem>
                  <DropdownItem href="/random">Random Cube</DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
              <UncontrolledDropdown nav inNavbar>
                <DropdownToggle nav caret>
                  About
                </DropdownToggle>
                <DropdownMenu right>
                  <DropdownItem href="https://www.inkedgaming.com/collections/artists/gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
                    Merchandise
                  </DropdownItem>
                  <DropdownItem href="/contact">Contact</DropdownItem>
                  <DropdownItem href="/dev/blog">Dev Blog</DropdownItem>
                  <DropdownItem href="/ourstory">Our Story</DropdownItem>
                  <DropdownItem href="/faq">FAQ</DropdownItem>
                  <DropdownItem href="/donate">Donate</DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
              {user ? (
                <>
                  <NotificationsNav user={user} />
                  <UncontrolledDropdown nav inNavbar>
                    <DropdownToggle nav caret>
                      {user.username}
                    </DropdownToggle>
                    <DropdownMenu right>
                      <DropdownItem href={`/user/view/${user.id}`}>Your Profile</DropdownItem>
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
                    <LoginModalLink>Login</LoginModalLink>
                  </NavItem>
                </>
              )}
            </Nav>
          </Collapse>
        </Container>
      </Navbar>
      <Container className="flex-grow">
        <ErrorBoundary>{children}</ErrorBoundary>
      </Container>
      <Footer />
    </div>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

MainLayout.defaultProps = {
  user: null,
};

export default MainLayout;
