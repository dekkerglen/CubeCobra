import React, { useState } from 'react';

import { Col, Card, CardBody } from 'reactstrap';
import UserPropType from 'proptypes/UserPropType';

const AD_RATE = 2; // an ad appears with probability of 1/AD_RATE

const adOptions = [
  <>
    Cube Cobra's hosting fees are covered completely by donations. If you enjoy the service Cube Cobra provides, please
    consider{' '}
    <strong>
      <a href="https://www.patreon.com/cubecobra">donating</a>
    </strong>
    .
  </>,

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
    Become a{' '}
    <strong>
      <a href="/donate">supporter</a>
    </strong>{' '}
    of Cube Cobra to remove these messages and gain access to exclusive features!
  </>,
];

const Advertisement = ({ user }) => {
  const [option] = useState(Math.floor(Math.random() * adOptions.length * AD_RATE));
  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;
  if (option < adOptions.length) {
    return (
      <Col xs="12" className="py-2">
        <Card>
          <CardBody className="bg-advert">{adOptions[option]}</CardBody>
        </Card>
      </Col>
    );
  }
  return <></>;
};

Advertisement.propTypes = {
  user: UserPropType,
};

Advertisement.defaultProps = {
  user: null,
};

export default Advertisement;
