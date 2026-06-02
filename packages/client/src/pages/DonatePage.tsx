import React from 'react';

import { CheckIcon, HeartFillIcon } from '@primer/octicons-react';
import { PatronLevels } from '@utils/datatypes/Patron';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import { PatronTierBadge } from 'components/user/PatronBadge';
import HelpLayout from 'layouts/HelpLayout';

const PATREON_URL = 'https://www.patreon.com/cubecobra';
const PAYPAL_URL = 'https://www.paypal.me/cubecobra';
const DISCORD_URL = 'https://discord.gg/YYF9x65Ane';

interface Tier {
  level: number;
  price: string;
  tagline: string;
  perks: string[];
  highlight?: boolean;
}

// Tiers mirror the Cube Cobra Patreon. Prices are documented for context, but
// the page also points visitors to Patreon for the authoritative pricing.
const TIERS: Tier[] = [
  {
    level: PatronLevels['Cobra Hatchling'],
    price: 'Entry tier',
    tagline: 'Support the site and browse ad-free.',
    perks: [
      'A completely ad-free Cube Cobra',
      'A supporter badge on your profile',
      'Access to supporter-only Discord channels',
    ],
  },
  {
    level: PatronLevels['Coiling Oracle'],
    price: 'From $5 / month',
    tagline: 'Put your cube in front of the whole community.',
    highlight: true,
    perks: [
      'Everything in Cobra Hatchling',
      'Feature your cube in the rotating Featured Cubes list',
      'A chance to appear in the daily Pack 1, Pick 1',
      'The distinctive Coiling Oracle badge',
    ],
  },
  {
    level: PatronLevels['Lotus Cobra'],
    price: 'From $15 / month',
    tagline: 'Help shape where Cube Cobra goes next.',
    perks: [
      'Everything in Coiling Oracle',
      'Submit high-priority feature requests',
      'Priority input with the development team',
      'The prestigious top-tier Lotus Cobra badge',
    ],
  },
];

const TierCard: React.FC<{ tier: Tier }> = ({ tier }) => (
  <Card className={`h-full ${tier.highlight ? 'border-2 border-button-accent' : ''}`}>
    <CardHeader className={tier.highlight ? 'bg-button-accent/10' : undefined}>
      <Flexbox direction="col" gap="1">
        <Flexbox direction="row" justify="between" alignItems="center" gap="2">
          <PatronTierBadge level={tier.level} />
          {tier.highlight && (
            <Text sm semibold className="uppercase text-button-accent">
              Most popular
            </Text>
          )}
        </Flexbox>
        <Text xl semibold>
          {PatronLevels[tier.level]}
        </Text>
        <Text md className="text-text-secondary">
          {tier.price}
        </Text>
      </Flexbox>
    </CardHeader>
    <CardBody className="h-full">
      <Flexbox direction="col" gap="3" className="h-full">
        <Text className="text-text-secondary">{tier.tagline}</Text>
        <Flexbox direction="col" gap="2">
          {tier.perks.map((perk) => (
            <Flexbox key={perk} direction="row" alignItems="start" gap="2">
              <span className="text-green-600 mt-1 flex-shrink-0">
                <CheckIcon size={14} />
              </span>
              <Text md>{perk}</Text>
            </Flexbox>
          ))}
        </Flexbox>
        <Button
          type="link"
          color={tier.highlight ? 'accent' : 'primary'}
          outline={!tier.highlight}
          block
          href={PATREON_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto"
        >
          Choose {PatronLevels[tier.level]}
        </Button>
      </Flexbox>
    </CardBody>
  </Card>
);

const DonatePage: React.FC = () => (
  <HelpLayout activeHref="/help/donate">
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
              Cube Cobra is free for everyone, and always will be. It is built and run by a tiny team and paid for by
              players like you. If the site has made your cubes better, becoming a supporter is what keeps it online and
              ad-free.
            </Text>
            <Flexbox direction="row" gap="2" wrap="wrap" justify="center">
              <Button type="link" color="accent" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
                Become a supporter
              </Button>
              <Button type="link" color="primary" outline href={PAYPAL_URL} target="_blank" rel="noopener noreferrer">
                Make a one-time donation
              </Button>
            </Flexbox>
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
          <Flexbox direction="col" gap="2">
            <p>
              Every contribution goes directly toward the cost of running Cube Cobra - servers, card data, image
              hosting, and the time it takes to keep building new features. There are no investors, and the tools you
              use every day are never locked behind a paywall.
            </p>
            <p>
              Supporters do not just remove ads. They unlock perks that make their cubes more visible and give them a
              real voice in how the site grows.
            </p>
          </Flexbox>
        </CardBody>
      </Card>

      {/* Membership tiers */}
      <Flexbox direction="col" gap="2">
        <Text xxl semibold>
          Membership tiers
        </Text>
        <Text className="text-text-secondary">
          Pick the tier that fits you. Every tier includes everything from the tiers before it.
        </Text>
        <Row className="mt-2">
          {TIERS.map((tier) => (
            <Col key={tier.level} xs={12} md={4} className="mb-2">
              <TierCard tier={tier} />
            </Col>
          ))}
        </Row>
        <Text md className="text-text-secondary">
          Pricing is set on Patreon and may change - see the{' '}
          <Link href={PATREON_URL} target="_blank" rel="noopener noreferrer">
            Cube Cobra Patreon
          </Link>{' '}
          for current tiers and exact prices.
        </Text>
      </Flexbox>

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
              what unlocks your badge, ad-free browsing, and the rest of your perks across the site.
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
