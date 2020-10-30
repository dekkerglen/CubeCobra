import React from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import DeckPropType from 'proptypes/DeckPropType';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardBody, CardHeader } from 'reactstrap';

import DeckPreview from 'components/DeckPreview';
import Paginate from 'components/Paginate';
import CubeLayout from 'layouts/CubeLayout';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CubeDecksPage = ({ user, cube, decks, pages, activePage, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
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
                canEdit={user._id === deck.owner}
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
  cube: CubePropType.isRequired,
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubeDecksPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeDecksPage);
