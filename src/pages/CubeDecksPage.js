import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader } from 'reactstrap';

import DeckPreview from 'components/DeckPreview';
import Paginate from 'components/Paginate';
import CubeLayout from 'layouts/CubeLayout';

const CubeDecksPage = ({ cube, cubeID, canEdit, decks, pages, activePage }) => (
  <CubeLayout cube={cube} cubeID={cubeID} activeLink="playtest">
    {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/decks/${cubeID}/${i}`} />}
    <Card>
      <CardHeader>
        <h5 className="mb-0">All Decks</h5>
      </CardHeader>
      <CardBody className="p-0">
        {decks.map((deck) => (
          <DeckPreview key={deck._id} deck={deck} canEdit={canEdit} />
        ))}
      </CardBody>
    </Card>
    {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/decks/${cubeID}/${i}`} />}
  </CubeLayout>
);

CubeDecksPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  canEdit: PropTypes.bool.isRequired,
  decks: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
};

export default CubeDecksPage;
