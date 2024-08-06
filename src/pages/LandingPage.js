import React from 'react';
import { Button, Col, Row } from 'reactstrap';

import CardSearchBar from 'components/CardSearchBar';
import LoginModal from 'components/LoginModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import Footer from 'layouts/Footer';

const LoginModalButton = withModal(Button, LoginModal);

const LandingPage = () => {
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
            <Button href="/user/register" className="landing-btn my-3" color="accent">
              Sign Up
            </Button>
            <LoginModalButton modalProps={{ loginCallback: '/' }} className="landing-btn mb-3" color="accent" outline>
              Login
            </LoginModalButton>
            <span data-ccpa-link="1" />
          </div>
          <Footer />
        </Col>
      </Row>
    </div>
  );
};

export default RenderToRoot(LandingPage);
