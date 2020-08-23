import React from 'react';
import PropTypes from 'prop-types';

import { Row, Col } from 'reactstrap';

import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';
import CubeLayout from 'layouts/CubeLayout';

const SamplePackPage = ({ cubeID, seed, pack, cube, canEdit }) => {
  return (
    <CubeLayout cube={cube} cubeID={cubeID} canEdit={canEdit} activeLink="playtest">
      <div className="container" />
      <br />
      <div className="card">
        <div className="card-header">
          <Row>
            <Col md={6}>
              <h5 className="card-title">Sample Pack</h5>
            </Col>
            <Col md={6} className="text-right">
              <a className="btn btn-success mr-2" href={`/cube/samplepack/${cubeID}`}>
                New Pack
              </a>
              <a className="btn btn-success" href={`/cube/samplepackimage/${cubeID}/${seed}`}>
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
                colProps={{ className: 'col-md-2-4 col-lg-2-4 col-xl-2-4', sm: '3', xs: '4' }}
                cardProps={{ autocard: true }}
                className="sample"
              />
            </Col>
          </Row>
        </div>
      </div>
    </CubeLayout>
  );
};

SamplePackPage.propTypes = {
  cubeID: PropTypes.string.isRequired,
  seed: PropTypes.string.isRequired,
  pack: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cube: PropTypes.shape({}).isRequired,
  canEdit: PropTypes.bool.isRequired,
};

export default SamplePackPage;
