import React from 'react';
import PropTypes from 'prop-types';

import { Row, Col, Card, CardHeader, CardBody } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const ContactPage = ({ user }) => (
  <MainLayout user={user}>
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <h5>Donate</h5>
      </CardHeader>
      <CardBody>
        <p>
          Donations are the best way to support Cube Cobra. All donations go towards mantainence costs for Cube Cobra.
        </p>
        <p>
          Patreon patrons will be invited to an exclusive discord channel where you will be able to contact me directly
          with feedback.
        </p>
        <p>
          Cube Cobra is also a TCGPlayer affiliate. If you use the link provided, part of your purchase will go towards
          supported Cube Cobra.
        </p>
        <Row>
          <Col xs="12" sm="4">
            <strong>Patreon (subscription)</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-3">
            <a href="https://www.patreon.com/cubecobra" target="_blank" rel="noopener noreferrer">
              https://www.patreon.com/cubecobra
            </a>
          </Col>
          <Col xs="12" sm="4">
            <strong>Paypal (one-time donation)</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-3">
            <a href="https://www.paypal.me/cubecobra" target="_blank" rel="noopener noreferrer">
              https://www.paypal.me/cubecobra
            </a>
          </Col>
          <Col xs="12" sm="4">
            <strong>TCGPlayer Affiliate</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-3">
            <a
              href="https://www.tcgplayer.com/&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.tcgplayer.com/
            </a>
          </Col>
        </Row>
      </CardBody>
    </Card>
  </MainLayout>
);

ContactPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

ContactPage.defaultProps = {
  user: null,
};

export default RenderToRoot(ContactPage);
