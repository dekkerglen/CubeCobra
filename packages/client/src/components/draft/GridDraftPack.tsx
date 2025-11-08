import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox,Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import FoilCardImage from 'components/FoilCardImage';
import CardType from '@utils/datatypes/Card';

interface PackProps {
  pack: CardType[];
  packNumber: number;
  pickNumber: number;
  seatIndex: number;
  makePick: (pick: { seatIndex: number; cardIndices: number[][] }) => void;
  turn?: number;
}

const Pack: React.FC<PackProps> = ({ pack, packNumber, pickNumber, makePick, seatIndex, turn }) => (
  <Card className="mt-3">
    <CardHeader>
      <Flexbox direction="row" justify="between" alignItems="center">
        <Text semibold lg>
          Pack {packNumber + 1}, Pick {pickNumber + 1}
        </Text>
        {turn && (
          <Text semibold lg>
            <span className={`badge ${turn === 1 ? 'badge-primary' : 'badge-danger'}`}>
              {`Player ${turn === 1 ? 'one' : 'two'}'s pick`}
            </span>
          </Text>
        )}
      </Flexbox>
    </CardHeader>
    <CardBody>
      <Row className="mb-2 justify-center">
        <Col xs={1}>
          <div />
        </Col>
        {[0, 1, 2].map((col) => (
          <Col key={`col-btn-${col}`} xs={3} md={2}>
            <Button
              block
              outline
              color="primary"
              onClick={() => {
                makePick({
                  seatIndex,
                  cardIndices: [0, 1, 2]
                    .map((row) => [pack[3 * row + col]?.index, 3 * row + col])
                    .filter(([x]) => x !== undefined) as number[][],
                });
              }}
            >
              🡇
            </Button>
          </Col>
        ))}
      </Row>
      {[0, 1, 2].map((row) => (
        <Row key={`row-${row}`} className="justify-center">
          <Col className="my-2" xs={1}>
            <Button
              className="float-end h-full"
              outline
              color="primary"
              onClick={() => {
                makePick({
                  seatIndex,
                  cardIndices: [0, 1, 2]
                    .map((col) => [pack[3 * row + col]?.index, 3 * row + col])
                    .filter(([x]) => x !== undefined) as number[][],
                });
              }}
            >
              🡆
            </Button>
          </Col>
          {[0, 1, 2].map((col) => (
            <Col key={`cell-${col}-${row}`} className="px-0" xs={3} md={2}>
              {pack[row * 3 + col] ? (
                <FoilCardImage card={pack[row * 3 + col]} autocard />
              ) : (
                <img
                  src="/content/default_card.png"
                  alt="Empty card slot"
                  width="100%"
                  height="auto"
                  className="card-border"
                />
              )}
            </Col>
          ))}
        </Row>
      ))}
    </CardBody>
  </Card>
);

export default Pack;
