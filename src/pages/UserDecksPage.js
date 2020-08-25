import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader } from 'reactstrap';

import DeckPreview from 'components/DeckPreview';
import Paginate from 'components/Paginate';
import UserLayout from 'layouts/UserLayout';
import DynamicFlash from 'components/DynamicFlash';
import Advertisement from 'components/Advertisement';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const UserDecksPage = ({ user, owner, followers, following, decks, pages, activePage }) => (
  <MainLayout user={user}>
    <UserLayout
      user={owner}
      followers={followers}
      following={following}
      canEdit={user && user.id === owner._id}
      activeLink="decks"
    >
      <Advertisement />
      <DynamicFlash />
      {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/user/decks/${owner._id}/${i}`} />}
      <Card>
        <CardHeader>
          <h5 className="mb-0">All Decks</h5>
        </CardHeader>
        {decks.length > 0 ? (
          <CardBody className="p-0">
            {decks.map((deck) => (
              <DeckPreview
                key={deck._id}
                deck={deck}
                canEdit={user && user.id === owner._id}
                nextURL={`/user/decks/${owner._id}/${activePage}`}
              />
            ))}
          </CardBody>
        ) : (
          <CardBody>No decks to show.</CardBody>
        )}
      </Card>
      {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/user/decks/${owner._id}/${i}`} />}
    </UserLayout>
  </MainLayout>
);

UserDecksPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  owner: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  decks: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
};

UserDecksPage.defaultProps = {
  user: null,
};

export default RenderToRoot(UserDecksPage);
