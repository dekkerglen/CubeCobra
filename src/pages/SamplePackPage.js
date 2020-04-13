import React from 'react';
import PropTypes from 'prop-types';

import { Row, Col } from 'reactstrap';

import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';

const SamplePackPage = ({ cube_id, seed, pack }) => {
  // eslint-disable-next-line camelcase
  const cubeId = cube_id;

  pack = pack.map((card) => {
    card.details = {
      name: card.name,
      image_normal: card.image_normal,
    };
    return card;
  });

  return (
    <div>
      <div className="container" />
      <br />
      <div className="card">
        <div className="card-header">
          <Row>
            <Col md={6}>
              <h5 className="card-title">Sample Pack</h5>
            </Col>
            <Col md={6} className="text-right">
              <a className="btn btn-success mr-2" href={`/cube/samplepack/${cubeId}`}>
                New Pack
              </a>
              <a className="btn btn-success" href={`/cube/samplepackimage/${cubeId}/${seed}`}>
                Get Image
              </a>
            </Col>
          </Row>
        </div>
        <div className="card-body">
          <Row noGutters className="pack-body justify-content-center">
            <Col style={{ maxWidth: '800px' }}>
              <CardGrid
                cardList={pack}
                Tag={CardImage}
                colProps={{ className: 'col-md-2-4', sm: '3', xs: '4' }}
                cardProps={{ autocard: true }}
                className="sample"
              />
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
};

SamplePackPage.propTypes = {
  cube_id: PropTypes.string.isRequired,
  seed: PropTypes.string.isRequired,
  pack: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default SamplePackPage;
