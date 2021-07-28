import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardBody, CardHeader, CardTitle, Col, Row, Spinner } from 'reactstrap';

import DraggableCard from 'components/DraggableCard';
import DraftLocation from 'drafting/DraftLocation';
import CardPropType from 'proptypes/CardPropType';

const canDrop = (_, target) => {
  return target.type === DraftLocation.PICKS;
};

const Pack = ({ pack, onMoveCard, onClickCard, loading }) => (
  <Card className="mt-3">
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-1">Pack ?, Pick ?</h4>
      </CardTitle>
    </CardHeader>
    <CardBody>
      {loading ? (
        <div className="centered py-3">
          <Spinner className="position-absolute" />
        </div>
      ) : (
        <Row noGutters>
          {pack.map((card, index) => (
            <Col
              key={`${card.details._id}`}
              xs={3}
              className="col-md-1-5 col-lg-1-5 col-xl-1-5 d-flex justify-content-center align-items-center"
            >
              <DraggableCard
                location={DraftLocation.pack(index)}
                data-index={index}
                card={card}
                canDrop={canDrop}
                onMoveCard={onMoveCard}
                onClick={() => onClickCard(index)}
              />
            </Col>
          ))}
        </Row>
      )}
    </CardBody>
  </Card>
);

Pack.propTypes = {
  pack: PropTypes.arrayOf(CardPropType).isRequired,
  onMoveCard: PropTypes.func.isRequired,
  onClickCard: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

Pack.defaultProps = {
  loading: false,
};

export default Pack;
