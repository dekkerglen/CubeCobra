import React from 'react';

import { cdnUrl } from '@utils/cdnUrl';
import { CardDetails, Legality } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import { nameToDashedUrlComponent } from 'utils/Affiliate';

import { CardBody } from '../base/Card';
import { Col, Flexbox, Row } from '../base/Layout';
import Link from '../base/Link';
import Table from '../base/Table';
import Text from '../base/Text';
import Markdown from '../Markdown';

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
}

const FORMATS = [
  'Standard',
  'Pioneer',
  'Modern',
  'Legacy',
  'Vintage',
  'Premodern',
  'Brawl',
  'Historic',
  'Timeless',
  'Pauper',
  'Penny',
  'Commander',
];

const LEGALITY: Record<Legality, { label: string; className: string }> = {
  legal: { label: 'Legal', className: 'bg-button-primary' },
  not_legal: { label: 'Not Legal', className: 'bg-button-secondary' },
  banned: { label: 'Banned', className: 'bg-button-danger' },
  restricted: { label: 'Restricted', className: 'bg-button-accent' },
};

const legalityRows = (card: CardDetails, from: number, to: number) =>
  FORMATS.slice(from, to).map((format) => {
    const status = LEGALITY[card.legalities[format]] ?? LEGALITY.not_legal;

    return {
      format,
      status: (
        <span
          className={`block rounded px-2 py-0.5 text-center text-xs font-semibold text-button-text ${status.className}`}
        >
          {status.label}
        </span>
      ),
    };
  });

const CardBreakdownInfo: React.FC<CardPageProps> = ({ card }) => {
  const externalLinks = [
    { label: 'Scryfall', href: card.scryfall_uri },
    { label: 'EDHREC', href: `https://edhrec.com/cards/${nameToDashedUrlComponent(card.name)}` },
    { label: 'MTG Top 8', href: `http://mtgtop8.com/search?MD_check=1&SB_check=1&cards=${card.name}` },
  ];

  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        <Flexbox direction="row" justify="between">
          <Text semibold>{card.name}</Text>
          <Flexbox direction="row">
            {card.parsed_cost
              .slice(0)
              .reverse()
              .map((symbol, index) => (
                <img
                  key={`mana-symbol-${index}`}
                  alt={symbol}
                  className="mana-symbol"
                  src={cdnUrl(`/content/symbols/${symbol}.png`)}
                />
              ))}
          </Flexbox>
        </Flexbox>
        <hr />
        <Text>{card.type}</Text>
        <hr />
        {card.oracle_text.split('\n').map((text) => (
          <Markdown markdown={text} key={text} />
        ))}
        <Flexbox direction="row" justify="between">
          <Text italic sm>
            {`Illustrated by ${card.artist}`}
          </Text>
          <Text semibold>
            {card.loyalty && card.loyalty}
            {card.power && `${card.power} / ${card.toughness}`}
          </Text>
        </Flexbox>

        {/* Set apart from the card's own text above, which is prose rather than data. */}
        <Row className="pt-6" gutters={2}>
          <Col xs={12} md={8}>
            <Text semibold lg>
              Legality
            </Text>
            {/* Two columns rather than one twelve-row list: a single table reads as a
                much taller block than the badge grid this replaced. */}
            <Row gutters={2}>
              <Col xs={6}>
                <Table rows={legalityRows(card, 0, 6)} />
              </Col>
              <Col xs={6}>
                <Table rows={legalityRows(card, 6, 12)} />
              </Col>
            </Row>
          </Col>
          <Col xs={12} md={4}>
            <Text semibold lg>
              Links
            </Text>
            <Table
              rows={externalLinks.map(({ label, href }) => ({
                // The card's name is the heading above; the labels do not repeat it.
                link: (
                  <Link href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                  </Link>
                ),
              }))}
            />
          </Col>
        </Row>
      </Flexbox>
    </CardBody>
  );
};

export default CardBreakdownInfo;
