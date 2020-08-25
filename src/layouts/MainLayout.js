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
  Row,
  Col,
} from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';
import LoginModal from 'components/LoginModal';
import CreateCubeModal from 'components/CreateCubeModal';
import withModal from 'components/WithModal';
import NotificationsNav from 'components/NotificationsNav';
import useToggle from 'hooks/UseToggle';

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
      <footer>
        <Container className="pt-3">
          <Row>
            <Col xs="6" sm="3">
              <small>
                <h6 className="footer-header">Cubes</h6>
                <ul className="footer-ul pl-0">
                  <li>
                    <a className="footer-link" href="/explore">
                      Explore Cubes
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/search">
                      Search Cubes
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/random">
                      Random Cube
                    </a>
                  </li>
                </ul>
              </small>
            </Col>
            <Col xs="6" sm="3">
              <small>
                <h6 className="footer-header">Cards</h6>
                <ul className="footer-ul pl-0">
                  <li>
                    <a className="footer-link" href="/tool/topcards">
                      Top Cards
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/tool/searchcards">
                      Search Cards
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/tool/randomcard">
                      Random Card
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/filters">
                      Filter Syntax
                    </a>
                  </li>
                </ul>
              </small>
            </Col>
            <Col xs="6" sm="3">
              <small>
                <h6 className="footer-header">Cube Cobra</h6>
                <ul className="footer-ul pl-0">
                  <li>
                    <a className="footer-link" href="/dev/blog">
                      Dev Blog
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/contact">
                      Contact
                    </a>
                  </li>
                  <li>
                    <a
                      className="footer-link"
                      href="https://www.inkedgaming.com/collections/artists/gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372"
                    >
                      Merchandise
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/ourstory">
                      Our Story
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/faq">
                      FAQ
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/donate">
                      Donate
                    </a>
                  </li>
                </ul>
              </small>
            </Col>
            <Col xs="6" sm="3">
              <small>
                <h6 className="footer-header">Misc</h6>
                <ul className="footer-ul pl-0">
                  <li>
                    <a className="footer-link" href="https://github.com/dekkerglen/CubeCobra">
                      Github
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/privacy">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/tos">
                      Terms & Conditions
                    </a>
                  </li>
                  <li>
                    <a className="footer-link" href="/cookies">
                      Cookies
                    </a>
                  </li>
                </ul>
              </small>
            </Col>
          </Row>
          <p className="center footer-text">
            Magic: The Gathering is ©{' '}
            <a className="footer-link" href="https://company.wizards.com/">
              Wizards of the Coast
            </a>
            . Cube Cobra is not affiliated nor produced nor endorsed by Wizards of the Coast.
            <br />
            All card images, mana symbols, expansions and art related to Magic the Gathering is a property of Wizards of
            the Coast/Hasbro.
            <br />
            This site is not affiliated nor endorsed by Scryfall LLC. This site endeavours to adhere to the Scryfall
            data guidelines.
            <br />
            Custom card images displayed in Cube Cobra are subject to the license terms under which they were uploaded
            to their hosts. Cube Cobra is not responsible for the content of custom card images. To report a custom card
            image violation, message the development team on{' '}
            <a className="footer-link" href="https://discord.gg/Hn39bCU">
              Discord
            </a>
            .
            <br />
            All other content Copyright © 2019 Cube Cobra
          </p>
        </Container>
      </footer>
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
