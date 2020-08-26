import React from 'react';
import PropTypes from 'prop-types';

import { Row, Col, Button } from 'reactstrap';

import RenderToRoot from 'utils/RenderToRoot';
import Footer from 'layouts/Footer';
import CardSearchBar from 'components/CardSearchBar';

const LandingPage = ({ numusers, numcubes, numdrafts }) => {
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
            <Button className="landing-btn my-3" color="success">
              Sign Up
            </Button>
            <Button className="landing-btn mb-3" color="success" outline>
              Login
            </Button>
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
};

export default RenderToRoot(LandingPage);
