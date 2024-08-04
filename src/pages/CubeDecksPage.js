import React from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import DeckPropType from 'proptypes/DeckPropType';

import DeckPreview from 'components/DeckPreview';
import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

const CubeDecksPage = ({ cube, decks, pages, activePage, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <CubeLayout cube={cube} activeLink="playtest">
      <div className="my-3">
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/deck/decks/${cube.id}/${i}`} />}
        <Card>
          <CardHeader>
            <h5 className="mb-0">All Decks</h5>
          </CardHeader>
          <CardBody className="p-0">
            {decks.map((deck) => (
              <DeckPreview key={deck.id} deck={deck} nextURL={`/cube/deck/decks/${cube.id}/${activePage}`} />
            ))}
          </CardBody>
        </Card>
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/deck/decks/${cube.id}/${i}`} />}
      </div>
    </CubeLayout>
  </MainLayout>
);

CubeDecksPage.propTypes = {
  cube: CubePropType.isRequired,
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  loginCallback: PropTypes.string,
};

CubeDecksPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeDecksPage);
