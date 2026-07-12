import React from 'react';

import { ArrowDownIcon, ArrowRightIcon } from '@primer/octicons-react';

import { cdnUrl } from '@utils/cdnUrl';
import CardType from '@utils/datatypes/Card';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import FoilCardImage from 'components/FoilCardImage';

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
          <Col key={`col-btn-${col}`} className="flex justify-center" xs={3} xl={2}>
            <Button
              className="flex h-10 w-10 items-center justify-center"
              outline
              color="primary"
              aria-label={`Pick column ${col + 1}`}
              onClick={() => {
                makePick({
                  seatIndex,
                  cardIndices: [0, 1, 2]
                    .map((row) => [pack[3 * row + col]?.index, 3 * row + col])
                    .filter(([x]) => x !== undefined) as number[][],
                });
              }}
            >
              <ArrowDownIcon size={24} />
            </Button>
          </Col>
        ))}
      </Row>
      {[0, 1, 2].map((row) => (
        <Row key={`row-${row}`} className="justify-center">
          <Col className="my-2 flex items-center justify-end" xs={1}>
            <Button
              className="flex h-10 w-10 items-center justify-center"
              outline
              color="primary"
              aria-label={`Pick row ${row + 1}`}
              onClick={() => {
                makePick({
                  seatIndex,
                  cardIndices: [0, 1, 2]
                    .map((col) => [pack[3 * row + col]?.index, 3 * row + col])
                    .filter(([x]) => x !== undefined) as number[][],
                });
              }}
            >
              <ArrowRightIcon size={24} />
            </Button>
          </Col>
          {[0, 1, 2].map((col) => (
            <Col key={`cell-${col}-${row}`} className="px-0" xs={3} xl={2}>
              {pack[row * 3 + col] ? (
                <FoilCardImage card={pack[row * 3 + col]} autocard />
              ) : (
                <img
                  src={cdnUrl('/content/loadingcard.png')}
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
