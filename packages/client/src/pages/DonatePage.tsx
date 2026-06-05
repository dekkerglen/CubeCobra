import React from 'react';

import { CheckIcon, HeartFillIcon } from '@primer/octicons-react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import HelpLayout from 'layouts/HelpLayout';

const PATREON_URL = 'https://www.patreon.com/cubecobra';
const PAYPAL_URL = 'https://www.paypal.me/cubecobra';
const DISCORD_URL = 'https://discord.gg/YYF9x65Ane';

const PERKS = [
  'Ad-free browsing across the site',
  'A supporter badge on your profile',
  'Access to supporter-only Discord channels',
  'Higher tiers can queue their cube for the rotating Featured Cubes list',
];

const DonatePage: React.FC = () => (
  <HelpLayout activeHref="/help/donate" noBanner>
    <Flexbox direction="col" gap="4">
      {/* Hero section */}
      <Card>
        <CardBody>
          <Flexbox direction="col" gap="3" alignItems="center" className="text-center py-3">
            <span className="text-red-500">
              <HeartFillIcon size={40} />
            </span>
            <Text xxxl semibold>
              Support Cube Cobra
            </Text>
            <Text lg className="text-text-secondary max-w-2xl">
              Cube Cobra is free to use. If you'd like to support the site, you can donate via{' '}
              <Link href={PATREON_URL} target="_blank" rel="noopener noreferrer">
                Patreon
              </Link>{' '}
              or{' '}
              <Link href={PAYPAL_URL} target="_blank" rel="noopener noreferrer">
                PayPal
              </Link>
              .
            </Text>
          </Flexbox>
        </CardBody>
      </Card>

      {/* Where support goes */}
      <Card>
        <CardHeader>
          <Text semibold lg>
            Where your support goes
          </Text>
        </CardHeader>
        <CardBody>
          <p>Donations go toward hosting costs and the development time it takes to maintain and improve the site.</p>
        </CardBody>
      </Card>

      {/* Supporter perks */}
      <Card>
        <CardHeader>
          <Text semibold lg>
            Supporter perks
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            {PERKS.map((perk) => (
              <Flexbox key={perk} direction="row" alignItems="start" gap="2">
                <span className="text-green-600 mt-1 flex-shrink-0">
                  <CheckIcon size={14} />
                </span>
                <Text md>{perk}</Text>
              </Flexbox>
            ))}
            <Text md className="text-text-secondary">
              See the{' '}
              <Link href={PATREON_URL} target="_blank" rel="noopener noreferrer">
                Cube Cobra Patreon
              </Link>{' '}
              for current tiers and pricing.
            </Text>
          </Flexbox>
        </CardBody>
      </Card>

      {/* After joining */}
      <Card>
        <CardHeader>
          <Text semibold lg>
            After you become a supporter
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <p>
              Once you have joined on Patreon, head to your{' '}
              <Link href="/user/account?nav=patreon">account settings</Link> and link your Patreon account. Linking is
              what unlocks your perks across the site.
            </p>
            <p>
              Having trouble with a subscription or a missing perk? Reach the team any time on{' '}
              <Link href={DISCORD_URL}>Discord</Link>.
            </p>
          </Flexbox>
        </CardBody>
      </Card>

      {/* Donation links */}
      <Card>
        <CardHeader>
          <Text semibold lg>
            Donation links
          </Text>
        </CardHeader>
        <CardBody>
          <Row>
            <Col xs={12} sm={4}>
              <Text semibold>Patreon (subscription)</Text>
            </Col>
            <Col xs={12} sm={8} className="mb-2">
              <Link href={PATREON_URL} target="_blank" rel="noopener noreferrer">
                {PATREON_URL}
              </Link>
            </Col>
            <Col xs={12} sm={4}>
              <Text semibold>PayPal (one-time donation)</Text>
            </Col>
            <Col xs={12} sm={8} className="mb-1">
              <Link href={PAYPAL_URL} target="_blank" rel="noopener noreferrer">
                {PAYPAL_URL}
              </Link>
            </Col>
          </Row>
        </CardBody>
      </Card>
    </Flexbox>
  </HelpLayout>
);

export default RenderToRoot(DonatePage);
