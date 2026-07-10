import React from 'react';

import classNames from 'classnames';

import { cdnUrl } from '@utils/cdnUrl';
import CardType from '@utils/datatypes/Card';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import FoilCardImage from 'components/FoilCardImage';

interface HousmanDraftPackProps {
  cards: CardType[]; // full draft card pool, indexed by card index
  pool: number[]; // face-up pool card indices
  hand: number[]; // the human's hand card indices
  selectedPoolCard: number | null; // card index currently selected to take
  highlightPoolCard?: number | null; // card index most recently swapped into the pool
  onPoolClick: (cardIndex: number) => void;
  onHandClick: (cardIndex: number) => void;
  interactive: boolean; // true when it is the human's turn
  round: number; // 1-based
  numRounds: number;
  exchangeNumber: number; // 1-based exchange for the active seat
  totalExchanges: number;
  statusText: string;
  statusColor: 'primary' | 'danger';
}

const CardSlot: React.FC<{
  card?: CardType;
  selected?: boolean;
  highlighted?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}> = ({ card, selected, highlighted, clickable, onClick }) => (
  <div
    className={classNames('rounded-md', {
      'cursor-pointer': clickable,
      'ring-4 ring-focus-ring': selected,
      'ring-4 ring-green-500': highlighted && !selected,
    })}
    onClick={clickable ? onClick : undefined}
  >
    {card ? (
      <FoilCardImage card={card} autocard />
    ) : (
      <img
        src={cdnUrl('/content/loadingcard.png')}
        alt="Empty card slot"
        width="100%"
        height="auto"
        className="card-border"
      />
    )}
  </div>
);

const HousmanDraftPack: React.FC<HousmanDraftPackProps> = ({
  cards,
  pool,
  hand,
  selectedPoolCard,
  highlightPoolCard,
  onPoolClick,
  onHandClick,
  interactive,
  round,
  numRounds,
  exchangeNumber,
  totalExchanges,
  statusText,
  statusColor,
}) => (
  <Card className="mt-3">
    <CardHeader>
      <Flexbox direction="row" justify="between" alignItems="center">
        <Text semibold lg>
          Round {round} of {numRounds}, Exchange {exchangeNumber} of {totalExchanges}
        </Text>
        <Text semibold lg>
          <span className={`badge ${statusColor === 'primary' ? 'badge-primary' : 'badge-danger'}`}>{statusText}</span>
        </Text>
      </Flexbox>
    </CardHeader>
    <CardBody>
      <Flexbox direction="col" gap="2">
        <Text semibold>Shared Pool</Text>
        {interactive && (
          <Text sm className="text-text-secondary">
            {selectedPoolCard === null
              ? 'Click a card in the pool to take, then click a card in your hand to give in exchange.'
              : 'Now click a card in your hand to give in exchange for the selected pool card.'}
          </Text>
        )}
        <Row className="justify-center">
          {pool.map((cardIndex, i) => (
            <Col key={`pool-${cardIndex}-${i}`} className="px-0" xs={4} md={2} xl={1}>
              <CardSlot
                card={cards[cardIndex]}
                selected={selectedPoolCard === cardIndex}
                highlighted={highlightPoolCard === cardIndex}
                clickable={interactive}
                onClick={() => onPoolClick(cardIndex)}
              />
            </Col>
          ))}
        </Row>

        <Text semibold className="mt-2">
          Your Hand
        </Text>
        <Row className="justify-center">
          {hand.map((cardIndex, i) => (
            <Col key={`hand-${cardIndex}-${i}`} className="px-0" xs={4} md={2} xl={2}>
              <CardSlot
                card={cards[cardIndex]}
                clickable={interactive && selectedPoolCard !== null}
                onClick={() => onHandClick(cardIndex)}
              />
            </Col>
          ))}
        </Row>
      </Flexbox>
    </CardBody>
  </Card>
);

export default HousmanDraftPack;
