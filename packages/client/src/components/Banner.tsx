import React, { useContext, useState } from 'react';

import { UserRoles } from '@utils/datatypes/User';

import UserContext, { UserContextValue } from '../contexts/UserContext';
import Advertisment from './Advertisment';
import { Card, CardBody } from './base/Card';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import ResponsiveDiv from './base/ResponsiveDiv';
import Text from './base/Text';

const BANNER_RATE: number = 10; // an alternate message appears with probability of 1/BANNER_RATE

const options: React.ReactNode[] = [
  <Card key="banner-0">
    <CardBody className="bg-advert overflow-hidden rounded-md">
      {' '}
      <Text lg>
        Become a supporter of Cube Cobra to remove these messages and gain access to exclusive features!{' '}
        <Link href="/donate">Find out more.</Link>
      </Text>
    </CardBody>
  </Card>,
];

interface BannerProps {
  className?: string;
}

const Banner: React.FC<BannerProps> = ({ className }) => {
  const user: UserContextValue | null = useContext(UserContext);
  const [option] = useState<number>(Math.floor(Math.random() * options.length * BANNER_RATE));

  if (user && Array.isArray(user.roles) && user.roles.includes(UserRoles.PATRON)) return <></>;

  if (option < options.length) {
    return <div className={`${className} pt-2 mx-2`}>{options[option]}</div>;
  }

  return (
    <Flexbox direction="row" justify="between" gap="2" className={`${className}`}>
      <ResponsiveDiv lg className="flex-grow pt-2">
        <Advertisment placementId="banner" media="desktop" size="banner" />
      </ResponsiveDiv>
      <ResponsiveDiv xxxl className="pb-8 pt-2">
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
