import React, { useContext, useState } from 'react';
import { Card, CardBody } from 'components/base/Card';
import Text from 'components/base/Text';
import Link from 'components/base/Link';

import Advertisment from 'components/Advertisment';
import UserContext, { UserContextValue } from 'contexts/UserContext';
import { Flexbox } from 'components/base/Layout';
import ResponsiveDiv from 'components/base/ResponsiveDiv';

const BANNER_RATE: number = 5; // an alternate message appears with probability of 1/BANNER_RATE

const options: React.ReactNode[] = [
  <Text lg>
    Enjoying Cube Cobra? You can help support Cube Cobra by purchasing playmats at our{' '}
    <Link href="https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
      inked gaming page
    </Link>
    !
  </Text>,
  <Text lg>
    Want to showcase your cube? You can feature it as a reward for{' '}
    <Link href="https://www.patreon.com/cubecobra">donating</Link> to Cube Cobra.{' '}
    <Link href="/donate">Find out more.</Link>
  </Text>,
  <Text lg>
    Become a supporter of Cube Cobra to remove these messages and gain access to exclusive features!{' '}
    <Link href="/donate">Find out more.</Link>
  </Text>,
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
