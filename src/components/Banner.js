import React, { useState, useContext } from 'react';

import { Col, Card, CardBody } from 'reactstrap';
import UserContext from 'contexts/UserContext';
import Advertisment from 'components/Advertisment';

const BANNER_RATE = 5; // an alternate message appears with probability of 1/BANNER_RATE

const options = [
  <>
    Enjoying Cube Cobra? You can help support Cube Cobra by purchasing playmats at our{' '}
    <strong>
      <a href="https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
        inked gaming page
      </a>
      !
    </strong>
  </>,
  <>
    Want to showcase your cube? You can feature it as a reward for{' '}
    <strong>
      <a href="https://www.patreon.com/cubecobra">donating</a>
    </strong>{' '}
    to Cube Cobra.{' '}
    <strong>
      <a href="/donate">Find out more.</a>
    </strong>
  </>,
  <>
    Become a supporter of Cube Cobra to remove these messages and gain access to exclusive features!{' '}
    <strong>
      <a href="/donate">Find out more.</a>
    </strong>
  </>,
  <>
    Interested in advertising on Cube Cobra?{' '}
    <strong>
      <a href="/contact">Contact us!</a>
    </strong>
  </>,
];

const Banner = () => {
  const user = useContext(UserContext);

  const [option] = useState(Math.floor(Math.random() * options.length * BANNER_RATE));
  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;
  if (option < options.length) {
    return (
      <Col xs="12" className="py-2">
        <Card>
          <CardBody className="bg-advert">{options[option]}</CardBody>
        </Card>
      </Col>
    );
  }
  return (
    <div className="py-2">
      <Advertisment placementId="banner" size="desktop" media="banner" demo />
      <Advertisment placementId="banner" size="mobile" media="mobile" demo />
    </div>
  );
};

export default Banner;
