import React, { useContext, useState } from 'react';

import UserContext, { UserContextValue } from '../contexts/UserContext';
import Advertisment from './Advertisment';
import { Card, CardBody } from './base/Card';
import { Col, Flexbox, Row } from './base/Layout';
import Link from './base/Link';
import ResponsiveDiv from './base/ResponsiveDiv';
import Text from './base/Text';

const BANNER_RATE: number = 3; // an alternate message appears with probability of 1/BANNER_RATE

const options: React.ReactNode[] = [
  <Row xs={6} key={0}>
    <Col xs={3} md={1}>
      <a href="/merchandise">
        <img src="/content/Final_cubecobra_small.png" alt="Year of the Snake" />
      </a>
    </Col>
    <Col xs={3} md={5} className="content-center">
      <Text lg>
        Our 2025 Lunar New Year merchandise is now available for pre-order! Check out our Year of the Snake playmat, pin
        and tokens <Link href="/merchandise">on our merchandise page</Link>!
      </Text>
    </Col>
  </Row>,
  <Row xs={6} key={0}>
    <Col xs={3} md={1}>
      <a href="/merchandise">
        <img src="/content/year_of_the_snake_tokens.png" alt="Year of the Snake" />
      </a>
    </Col>
    <Col xs={3} md={5} className="content-center">
      <Text lg>
        Our 2025 Lunar New Year merchandise is now available for pre-order! Check out our Year of the Snake playmat, pin
        and tokens <Link href="/merchandise">on our merchandise page</Link>!
      </Text>
    </Col>
  </Row>,
  <Row xs={6} key={0}>
    <Col xs={3} md={1}>
      <a href="/merchandise">
        <img src="/content/sticker_red.png" alt="Year of the Snake" />
      </a>
    </Col>
    <Col xs={3} md={5} className="content-center">
      <Text lg>
        Our 2025 Lunar New Year merchandise is now available for pre-order! Check out our Year of the Snake playmat, pin
        and tokens <Link href="/merchandise">on our merchandise page</Link>!
      </Text>
    </Col>
  </Row>,
  // <Text lg key={1}>
  //   Want to showcase your cube? You can feature it as a reward for{' '}
  //   <Link href="https://www.patreon.com/cubecobra">donating</Link> to Cube Cobra.{' '}
  //   <Link href="/donate">Find out more.</Link>
  // </Text>,
  // <Text lg key={2}>
  //   Become a supporter of Cube Cobra to remove these messages and gain access to exclusive features!{' '}
  //   <Link href="/donate">Find out more.</Link>
  // </Text>,
];

interface BannerProps {
  className?: string;
}

const Banner: React.FC<BannerProps> = ({ className }) => {
  const user: UserContextValue | null = useContext(UserContext);
  const [option] = useState<number>(Math.floor(Math.random() * options.length * BANNER_RATE));

  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;

  if (option < options.length) {
    return (
      <div className={`${className} py-2`}>
        <Card>
          <CardBody className="bg-advert overflow-hidden rounded-md">{options[option]}</CardBody>
        </Card>
      </div>
    );
  }

  return (
    <Flexbox direction="row" justify="between" gap="2" className={`${className}`}>
      <ResponsiveDiv lg className="flex-grow py-2">
        <Advertisment placementId="banner" media="desktop" size="banner" />
      </ResponsiveDiv>
      <ResponsiveDiv xxxl className="pb-8 py-2">
        <Card className="h-full bg-advert">
          <CardBody className="bg-advert h-full rounded-md">
            <Flexbox direction="col" justify="center" className="h-full">
              <Text lg>
                Tired of seeing advertisments? Become a supporter of Cube Cobra to remove all advertisments and gain
                access to exclusive features! <Link href="/donate">Find out more.</Link>
              </Text>
            </Flexbox>
          </CardBody>
        </Card>
      </ResponsiveDiv>
    </Flexbox>
  );
};

export default Banner;
