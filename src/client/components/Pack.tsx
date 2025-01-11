import React from 'react';
import { Card, CardBody, CardHeader } from './base/Card';
import { Col, Row } from './base/Layout';
import Text from './base/Text';
import DraggableCard from './DraggableCard';
import FoilCardImage from './FoilCardImage';
import DraftLocation from '../drafting/DraftLocation';
import CardType from '../../datatypes/Card';

interface PackProps {
  pack: CardType[];
  loading?: boolean;
  title?: string;
  disabled?: boolean;
}

const Pack: React.FC<PackProps> = ({ pack, loading = false, title = 'Pack', disabled = false }) => {
  return (
    <Card className="mt-3">
      <CardHeader>
        <Text semibold lg>
          {title}
        </Text>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="centered py-3">
            <div className="spinner" />
          </div>
        ) : (
          <Row className="g-0" sm={4} lg={8}>
            {pack.map((card, index) => (
              <Col
                key={`pack-${card.details?.scryfall_id}`}
                xs={1}
                className="col-md-1-5 col-lg-1-5 col-xl-1-5 d-flex justify-content-center align-items-center"
              >
                {disabled ? (
                  <FoilCardImage card={card} autocard />
                ) : (
                  <DraggableCard location={DraftLocation.pack(index)} data-index={index} card={card} />
                )}
              </Col>
            ))}
          </Row>
        )}
      </CardBody>
    </Card>
  );
};

export default Pack;
