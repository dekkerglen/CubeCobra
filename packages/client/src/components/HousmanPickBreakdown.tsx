import React, { useEffect, useMemo } from 'react';

import classNames from 'classnames';

import { cardName } from '@utils/cardutil';
import Draft from '@utils/datatypes/Draft';

import { buildHousmanSteps, EXCHANGES } from '../drafting/housmandraftutils';
import useQueryParam from '../hooks/useQueryParam';
import { Card, CardBody, CardHeader } from './base/Card';
import { Col, Flexbox, Row } from './base/Layout';
import Text from './base/Text';
import HousmanCardRow from './draft/HousmanCardRow';
import FoilCardImage from './FoilCardImage';

interface HousmanPickBreakdownProps {
  draft: Draft;
  seatNumber: number;
}

const HousmanPickBreakdown: React.FC<HousmanPickBreakdownProps> = ({ draft, seatNumber }) => {
  const [pickParam, setPickParam] = useQueryParam('pick', '0');

  const allSteps = useMemo(() => buildHousmanSteps(draft), [draft]);
  const seatSteps = useMemo(() => allSteps.filter((step) => step.seat === seatNumber), [allSteps, seatNumber]);

  const selected = Math.max(0, Math.min(seatSteps.length - 1, parseInt(pickParam || '0', 10) || 0));

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selected > 0) {
        setPickParam((selected - 1).toString());
      } else if (e.key === 'ArrowRight' && selected < seatSteps.length - 1) {
        setPickParam((selected + 1).toString());
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selected, seatSteps.length, setPickParam]);

  if (!draft.HousmanLog || draft.HousmanLog.length === 0) {
    return <Text>Sorry, we cannot display the pick breakdown for this draft.</Text>;
  }

  if (seatSteps.length === 0) {
    return <Text>This seat made no exchanges in this draft.</Text>;
  }

  const cards = draft.cards;
  const step = seatSteps[selected]!;

  // Post-draft, every deck is public, so nothing needs hiding in the breakdown.
  const alwaysKnown = () => true;

  return (
    <Flexbox direction="col" gap="2">
      <Text sm className="text-text-secondary">
        Step through this seat&apos;s exchanges. Click an exchange on the left, or use the ← and → arrow keys.
      </Text>
      <Row>
        <Col xs={12} md={4} lg={3}>
          <div className="max-h-[70vh] overflow-y-auto pe-2">
            <Flexbox direction="col" gap="1">
              {seatSteps.map((s, index) => {
                const isNewRound = index === 0 || seatSteps[index - 1]!.round !== s.round;
                return (
                  <React.Fragment key={`step-${index}`}>
                    {isNewRound && (
                      <Text semibold sm className="mt-2">
                        Round {s.round + 1}
                      </Text>
                    )}
                    <div
                      className={classNames('cursor-pointer rounded-md px-2 py-1', {
                        'bg-bg-active': index === selected,
                        'hover:bg-bg-accent': index !== selected,
                      })}
                      onClick={() => setPickParam(index.toString())}
                    >
                      <Text sm>
                        Exchange {s.seatExchange}: took{' '}
                        <span className="font-semibold">{cardName(cards[s.taken]!)}</span>
                      </Text>
                    </div>
                  </React.Fragment>
                );
              })}
            </Flexbox>
          </div>
        </Col>
        <Col xs={12} md={8} lg={9}>
          <Card>
            <CardHeader>
              <Text semibold lg>
                Round {step.round + 1}: Exchange {step.seatExchange} of {EXCHANGES}
              </Text>
            </CardHeader>
            <CardBody>
              <Flexbox direction="col" gap="2">
                <Text>
                  Took <span className="font-semibold">{cardName(cards[step.taken]!)}</span> from the pool and gave{' '}
                  <span className="font-semibold">{cardName(cards[step.given]!)}</span>.
                </Text>

                <Text semibold sm className="mt-2">
                  Shared pool — the highlighted card is the one taken
                </Text>
                <HousmanCardRow
                  cards={cards}
                  indices={step.poolBefore}
                  isKnown={alwaysKnown}
                  highlight={step.taken}
                  xs={3}
                  md={2}
                  xl={1}
                />

                <Row className="mt-2">
                  <Col xs={12} md={6}>
                    <Flexbox direction="col" gap="2">
                      <Text semibold sm>
                        Gave to the pool
                      </Text>
                      <Row>
                        <Col xs={4} md={3}>
                          <FoilCardImage card={cards[step.given]} autocard />
                        </Col>
                      </Row>
                    </Flexbox>
                  </Col>
                </Row>

                <Text semibold sm className="mt-2">
                  Hand after this exchange
                </Text>
                <HousmanCardRow cards={cards} indices={step.handAfter} isKnown={alwaysKnown} xs={3} md={2} xl={2} />
              </Flexbox>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </Flexbox>
  );
};

export default HousmanPickBreakdown;
