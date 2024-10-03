import React, { useContext, useState } from 'react';
import { Card, CardBody } from 'components/base/Card';
import Text from 'components/base/Text';
import Link from 'components/base/Link';

import Advertisment from 'components/Advertisment';
import UserContext, { UserContextValue } from 'contexts/UserContext';

const BANNER_RATE: number = 3; // an alternate message appears with probability of 1/BANNER_RATE

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

const Banner: React.FC = () => {
  const user: UserContextValue | null = useContext(UserContext);
  const [option] = useState<number>(Math.floor(Math.random() * options.length * BANNER_RATE));

  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;

  if (option < options.length) {
    return (
      <Card className="my-2">
        <CardBody className="bg-advert">{options[option]}</CardBody>
      </Card>
    );
  }

  return (
    <div className="py-2">
      {
        // @ts-expect-error FIXME: Fix types here.
        <Advertisment placementId="banner" size="desktop" media="banner" demo />
      }
      {
        // @ts-expect-error FIXME: Fix types here.
        <Advertisment placementId="banner" size="mobile" media="mobile" demo />
      }
    </div>
  );
};

export default Banner;
