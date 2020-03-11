import React from 'react';
import PropTypes from 'prop-types';

import { Col, Row } from 'reactstrap';
import CubesCard from 'components/CubesCard';
import CubeSearchNavBar from 'components/CubeSearchNavBar';

const ExplorePage = ({ recents, featured, drafted, recentlyDrafted }) => {
  return (
    <>
      <CubeSearchNavBar />
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
    </>
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
};

export default ExplorePage;
