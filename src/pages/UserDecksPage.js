import React from 'react';
import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';

import { Card, CardBody, CardHeader } from 'reactstrap';

import DeckPreview from 'components/DeckPreview';
import Paginate from 'components/Paginate';
import UserLayout from 'layouts/UserLayout';
import DynamicFlash from 'components/DynamicFlash';
import Banner from 'components/Banner';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

function UserDecksPage({ owner, followers, following, decks, pages, activePage, loginCallback }) {
  return (
    <MainLayout loginCallback={loginCallback}>
      <UserLayout user={owner} followers={followers} following={following} activeLink="decks">
        <Banner />
        <DynamicFlash />
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/user/decks/${owner.id}/${i}`} />}
        <Card>
          <CardHeader>
            <h5 className="mb-0">All Decks</h5>
          </CardHeader>
          {decks.length > 0 ? (
            <CardBody className="p-0">
              {decks.map((deck) => (
                <DeckPreview key={deck.id} deck={deck} nextURL={`/user/decks/${owner.id}/${activePage}`} />
              ))}
            </CardBody>
          ) : (
            <CardBody>No decks to show.</CardBody>
          )}
        </Card>
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/user/decks/${owner.id}/${i}`} />}
      </UserLayout>
    </MainLayout>
  );
}

UserDecksPage.propTypes = {
  owner: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  loginCallback: PropTypes.string,
};

UserDecksPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(UserDecksPage);
