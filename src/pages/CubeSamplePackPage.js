import React from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';
import UserPropType from 'proptypes/UserPropType';

import { Row, Col } from 'reactstrap';

import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';
import CubeLayout from 'layouts/CubeLayout';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const SamplePackPage = ({ user, seed, pack, cube, loginCallback }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
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
              <Col md={6} className="text-right">
                <a className="btn btn-success mr-2" href={`/cube/samplepack/${cube._id}`}>
                  New Pack
                </a>
                <a className="btn btn-success" href={`/cube/samplepackimage/${cube._id}/${seed}`}>
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
    </MainLayout>
  );
};

SamplePackPage.propTypes = {
  seed: PropTypes.string.isRequired,
  pack: PropTypes.arrayOf(CardPropType).isRequired,
  cube: CubePropType.isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};
SamplePackPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(SamplePackPage);
