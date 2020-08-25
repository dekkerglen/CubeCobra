import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader } from 'reactstrap';

import DeckPreview from 'components/DeckPreview';
import Paginate from 'components/Paginate';
import CubeLayout from 'layouts/CubeLayout';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CubeDecksPage = ({ user, cube, decks, pages, activePage }) => (
  <MainLayout user={user}>
    <DynamicFlash />
    <CubeLayout cube={cube} cubeID={cube._id} activeLink="playtest">
      <div className="my-3">
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/decks/${cube._id}/${i}`} />}
        <Card>
          <CardHeader>
            <h5 className="mb-0">All Decks</h5>
          </CardHeader>
          <CardBody className="p-0">
            {decks.map((deck) => (
              <DeckPreview
                key={deck._id}
                deck={deck}
                canEdit={user.id === deck.owner}
                nextURL={`/cube/decks/${cube._id}/${activePage}`}
              />
            ))}
          </CardBody>
        </Card>
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/decks/${cube._id}/${i}`} />}
      </div>
    </CubeLayout>
  </MainLayout>
);

CubeDecksPage.propTypes = {
  cube: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  decks: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

CubeDecksPage.defaultProps = {
  user: null,
};

export default RenderToRoot(CubeDecksPage);
