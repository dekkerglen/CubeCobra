import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, Row, Col, CardBody } from 'reactstrap';

import CubeSearchNavBar from 'components/CubeSearchNavBar';
import CubePreview from 'components/CubePreview';
import Paginate from 'components/Paginate';

const SearchPage = ({ cubes, query, count, perPage, page, order }) => {
  const pages = Math.ceil(count / perPage);

  return (
    <>
      <CubeSearchNavBar query={query} order={order} title="Cube Search" />
      <br />
      {(cubes && cubes.length) > 0 ? (
        <Card>
          <CardHeader>
            {pages > 1 ? (
              <>
                <h5>
                  {`Displaying ${perPage * page + 1}-${Math.min(count, perPage * (page + 1))} of ${count} Results`}
                </h5>
                <Paginate count={pages} active={page} urlF={(i) => `/search/${query}/${i}?order=${order}`} />
              </>
            ) : (
              <h5>{`Displaying all ${count} Results`}</h5>
            )}
          </CardHeader>
          <Row>
            {cubes.slice(0, 36).map((cube) => (
              <Col className="pb-4" xl={3} lg={3} md={4} sm={6} xs={12}>
                <CubePreview cube={cube} />
              </Col>
            ))}
          </Row>
          {pages > 1 && (
            <CardBody>
              <Paginate count={pages} active={page} urlF={(i) => `/search/${query}/${i}?order=${order}`} />
            </CardBody>
          )}
        </Card>
      ) : (
        <h4>No Results</h4>
      )}
    </>
  );
};

SearchPage.propTypes = {
  cubes: PropTypes.arrayOf(
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
  ).isRequired,
  query: PropTypes.string,
  count: PropTypes.number,
  perPage: PropTypes.number,
  page: PropTypes.number,
  order: PropTypes.string,
};

SearchPage.defaultProps = {
  query: '',
  count: 0,
  perPage: 0,
  page: 0,
  order: 'date',
};

export default SearchPage;
