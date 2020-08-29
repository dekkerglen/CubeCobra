import React from 'react';
import PropTypes from 'prop-types';

import { Row, Col, Button } from 'reactstrap';

import RenderToRoot from 'utils/RenderToRoot';
import Footer from 'layouts/Footer';
import LoginModal from 'components/LoginModal';
import withModal from 'components/WithModal';
import CardSearchBar from 'components/CardSearchBar';

const LoginModalButton = withModal(Button, LoginModal);

const LandingPage = ({ numusers, numcubes, numdrafts, loginCallback }) => {
  return (
    <div className="flex-container flex-vertical viewport">
      <Row className="m-0 p-0 flex-grow">
        <Col xs="12" sm="6" className="m-0 bg-green landing-half landing-logo-container">
          <img src="/content/LandingLogo.png" alt="Cube Cobra" className="landing-logo" />
        </Col>
        <Col xs="12" sm="6" className="m-0 bg-dark landing-half flex-container flex-vertical">
          <div className="mt-3 flex-container">
            <CardSearchBar />
          </div>
          <div className="flex-grow centered flex-vertical">
            <h4 className="center footer-text  mt-4">Build, playtest, and share your Magic the Gathering cube!</h4>
            <br />
            <h5 className="center footer-text">
              <strong>{numusers}</strong>
              {' Users, '}
              <strong>{numcubes}</strong>
              {' Cubes, '}
              <strong>{numdrafts}</strong>
              {' Completed Drafts'}
            </h5>
            <Button href="/user/register" className="landing-btn my-3" color="success">
              Sign Up
            </Button>
            <LoginModalButton className="landing-btn mb-3" color="success" outline>
              Login
            </LoginModalButton>
          </div>
          <Footer />
        </Col>
      </Row>
    </div>
  );
};

LandingPage.propTypes = {
  numusers: PropTypes.string.isRequired,
  numcubes: PropTypes.string.isRequired,
  numdrafts: PropTypes.string.isRequired,
  loginCallback: PropTypes.string,
};

export default RenderToRoot(LandingPage);
