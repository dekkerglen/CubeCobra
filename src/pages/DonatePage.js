import React from 'react';
import PropTypes from 'prop-types';

import { Row, Col, Card, CardHeader, CardBody } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const ContactPage = ({ loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <h4>Donate</h4>
      </CardHeader>
      <CardBody>
        <p>
          Donations are the best way to support Cube Cobra. All donations go towards maintenance costs for Cube Cobra.
        </p>
        <h5>How to Donate</h5>
        <p>
          You can donate to Cube Cobra by becoming a patron on Patreon. Our patrons receive a range of exclusive
          features in return for their generous support. We also accept one-time donations through PayPal, and we are a
          TCGPlayer affiliate; buying cards using the provided link means part of your purchase goes towards Cube Cobra.
          Lastly, you can support us by buying our merchandise from Inked Gaming.
        </p>
        <h5>Patreon Rewards</h5>
        <ul>
          <li>A totally ad-free browsing experience</li>
          <li>
            Access to exclusive <a href="https://discord.gg/Hn39bCU">Discord</a> channels available only to Patreon
            supporters
          </li>
          <li>
            A place for your cube on the <strong>Featured Cubes</strong> list (from $5/month)
          </li>
          <li>
            Ability to submit high priority feature requests that will be prioritized by the developers (from $15/month)
          </li>
        </ul>
        <p>
          After becoming a patron, make sure to <a href="/user/account?nav=patreon">link your Cube Cobra account</a> to
          gain access to these benefits. If you are experiencing issues with your Patreon subscription, feel free to
          contact us on <a href="https://discord.gg/Hn39bCU">Discord</a>.
        </p>
        <h5>Donation Links</h5>
        <Row>
          <Col xs="12" sm="4">
            <strong>Patreon (subscription)</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-1">
            <a href="https://www.patreon.com/cubecobra" target="_blank" rel="noopener noreferrer">
              https://www.patreon.com/cubecobra
            </a>
          </Col>
          <Col xs="12" sm="4">
            <strong>Paypal (one-time donation)</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-1">
            <a href="https://www.paypal.me/cubecobra" target="_blank" rel="noopener noreferrer">
              https://www.paypal.me/cubecobra
            </a>
          </Col>
          <Col xs="12" sm="4">
            <strong>TCGPlayer Affiliate</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-1">
            <a
              href="https://www.tcgplayer.com/&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.tcgplayer.com/
            </a>
          </Col>
          <Col xs="12" sm="4" className="mb-1">
            <strong>Inked Gaming (merch store)</strong>
          </Col>
          <Col xs="12" sm="8">
            <a
              href="https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.inkedgaming.com/collections/artists-gwen-dekker
            </a>
          </Col>
        </Row>
      </CardBody>
    </Card>
  </MainLayout>
);

ContactPage.propTypes = {
  loginCallback: PropTypes.string,
};

ContactPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(ContactPage);
