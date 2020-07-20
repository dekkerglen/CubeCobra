import React from 'react';
import PropTypes from 'prop-types';

import DeckPreview from 'components/DeckPreview';
import Advertisement from 'components/Advertisement';
import Paginate from 'components/Paginate';

import { Card, Col, Row, CardHeader, CardBody, CardFooter } from 'reactstrap';

const PER_PAGE = 30;

const RecentDrafts = ({ decks, currentPage, totalPages, count }) => (
  <>
    <Advertisement />
    <Row className="mt-3">
      <Col xs="12">
        <Card>
          <CardHeader>
            {totalPages > 1 ? (
              <>
                <h5>
                  {`Displaying ${PER_PAGE * currentPage + 1}-${Math.min(
                    count,
                    PER_PAGE * (currentPage + 1),
                  )} of ${count} Drafts of Your Cubes`}
                </h5>
                <Paginate count={totalPages} active={currentPage} urlF={(i) => `/dashboard/decks/${i}`} />
              </>
            ) : (
              <h5>{`Displaying all ${count} Drafts of Your Cubes`}</h5>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {decks.length > 0 ? (
              decks.map((deck) => <DeckPreview key={deck._id} deck={deck} nextURL="/dashboard" canEdit />)
            ) : (
              <p className="m-2">
                Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
                <a href="https://discord.gg/Hn39bCU">Discord draft exchange?</a>
              </p>
            )}
          </CardBody>
          <CardFooter>
            <Paginate count={totalPages} active={currentPage} urlF={(i) => `/dashboard/decks/${i}`} />
          </CardFooter>
        </Card>
      </Col>
    </Row>
  </>
);

RecentDrafts.propTypes = {
  decks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  count: PropTypes.number.isRequired,
};

export default RecentDrafts;
