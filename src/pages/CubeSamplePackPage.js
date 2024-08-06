import React from 'react';
import { Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';

import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

const SamplePackPage = ({ seed, pack, cube, loginCallback }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DynamicFlash />
        <div className="container" />
        <br />
        <div className="card">
          <div className="card-header">
            <Row>
              <Col md={6}>
                <h5 className="card-title">Sample Pack</h5>
              </Col>
              <Col md={6} className="text-end">
                <a className="btn btn-accent me-2" href={`/cube/samplepack/${cube.id}`}>
                  New Pack
                </a>
                <a className="btn btn-accent" href={`/cube/samplepackimage/${cube.id}/${seed}`}>
                  Get image
                </a>
              </Col>
            </Row>
          </div>
          <div className="card-body">
            <Row className="pack-body justify-content-center g-0">
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
    </MainLayout>
  );
};

SamplePackPage.propTypes = {
  seed: PropTypes.string.isRequired,
  pack: PropTypes.arrayOf(CardPropType).isRequired,
  cube: CubePropType.isRequired,
  loginCallback: PropTypes.string,
};
SamplePackPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(SamplePackPage);
