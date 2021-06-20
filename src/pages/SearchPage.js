import React from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardHeader, Row, Col, CardBody } from 'reactstrap';

import CubeSearchNavBar from 'components/CubeSearchNavBar';
import CubePreview from 'components/CubePreview';
import Paginate from 'components/Paginate';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const SearchPage = ({ user, cubes, query, count, perPage, page, order, loginCallback }) => {
  const pages = Math.ceil(count / perPage);

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeSearchNavBar query={query} order={order} title="Cube Search" user={user} />
      <br />
      <DynamicFlash />
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
    </MainLayout>
  );
};

SearchPage.propTypes = {
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
  query: PropTypes.string,
  count: PropTypes.number,
  perPage: PropTypes.number,
  page: PropTypes.number,
  order: PropTypes.string,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

SearchPage.defaultProps = {
  query: '',
  count: 0,
  perPage: 0,
  page: 0,
  order: 'date',
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(SearchPage);
