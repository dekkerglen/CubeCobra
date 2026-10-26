import React from 'react';

import { cdnUrl } from '@utils/cdnUrl';
import { CardDetails, Legality } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import { nameToDashedUrlComponent } from 'utils/Affiliate';

import Button from '../base/Button';
import { CardBody } from '../base/Card';
import { Col, Flexbox, Row } from '../base/Layout';
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

interface LegalityListProps {
  card: CardDetails;
  from: number;
  to: number;
}

/**
 * Striped by hand rather than through Table. The rows carry a chip and a label, not
 * tabular data, and the chip has to lead so it sits beside the format it describes
 * rather than at the far end of a column.
 */
const LegalityList: React.FC<LegalityListProps> = ({ card, from, to }) => (
  <Flexbox direction="col">
    {FORMATS.slice(from, to).map((format, index) => {
      const status = LEGALITY[card.legalities[format]] ?? LEGALITY.not_legal;

      return (
        <div
          key={format}
          data-legality-row
          className={`flex items-center gap-2 px-2 py-1 ${index % 2 === 0 ? 'bg-bg-accent/80' : 'bg-bg-active/80'}`}
        >
          <span
            className={`w-20 shrink-0 rounded px-2 py-0.5 text-center text-xs font-semibold text-button-text ${status.className}`}
          >
            {status.label}
          </span>
          <Text sm>{format}</Text>
        </div>
      );
    })}
  </Flexbox>
);

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

        <hr className="mt-4" />
        {/* Two columns rather than one twelve-row list: a single table reads as a much
            taller block than the badge grid this replaced. */}
        <Row gutters={2}>
          <Col xs={6}>
            <LegalityList card={card} from={0} to={6} />
          </Col>
          <Col xs={6}>
            <LegalityList card={card} from={6} to={12} />
          </Col>
        </Row>

        {/* Three references share a row. As a table they read as a stub beside the
            twelve-row legality list. */}
        <Row className="pt-2" gutters={2}>
          {externalLinks.map(({ label, href }) => (
            <Col key={label} xs={12} md={4}>
              <Button type="link" outline color="secondary" block href={href} target="_blank">
                {label}
              </Button>
            </Col>
          ))}
        </Row>
      </Flexbox>
    </CardBody>
  );
};

export default CardBreakdownInfo;
