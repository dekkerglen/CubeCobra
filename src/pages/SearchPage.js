import React from 'react';

import { Card, CardHeader, Row, Col, Input, Label, CardBody } from 'reactstrap';

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

export default SearchPage;
