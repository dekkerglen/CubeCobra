import React from 'react';
import PropTypes from 'prop-types';

import { Col, Row } from 'reactstrap';
import CubesCard from 'components/CubesCard';
import CubeSearchNavBar from 'components/CubeSearchNavBar';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const ExplorePage = ({ user, recents, featured, drafted, recentlyDrafted, loginCallback }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeSearchNavBar />
      <DynamicFlash />
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard title="Featured Cubes" cubes={featured} />
          <CubesCard title="Recently Updated Cubes" cubes={recents} />
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard title="Most Drafted Cubes" cubes={drafted} />
          <CubesCard title="Recently Drafted Cubes" cubes={recentlyDrafted} />
        </Col>
      </Row>
    </MainLayout>
  );
};

const cubesListProp = PropTypes.arrayOf(
  PropTypes.shape({
    _id: PropTypes.string.isRequired,
    shortId: PropTypes.string,
    urlAlias: PropTypes.string,
    name: PropTypes.string.isRequired,
    card_count: PropTypes.number.isRequired,
    type: PropTypes.string.isRequired,
    overrideCategory: PropTypes.bool,
    categoryOverride: PropTypes.string,
    categoryPrefixes: PropTypes.arrayOf(PropTypes.string),
    image_name: PropTypes.string.isRequired,
    image_artist: PropTypes.string.isRequired,
    image_uri: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    owner_name: PropTypes.string.isRequired,
  }),
);

ExplorePage.propTypes = {
  recents: cubesListProp.isRequired,
  featured: cubesListProp.isRequired,
  drafted: cubesListProp.isRequired,
  recentlyDrafted: cubesListProp.isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
};

ExplorePage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(ExplorePage);
