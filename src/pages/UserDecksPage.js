import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader } from 'reactstrap';

import DeckPreview from 'components/DeckPreview';
import Paginate from 'components/Paginate';
import UserLayout from 'layouts/UserLayout';

const UserDecksPage = ({ user, followers, following, canEdit, decks, pages, activePage }) => (
  <UserLayout user={user} followers={followers} following={following} canEdit={canEdit} activeLink="decks">
    {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/user/decks/${user._id}/${i}`} />}
    <Card>
      <CardHeader>
        <h5 className="mb-0">All Decks</h5>
      </CardHeader>
      {decks.length > 0 ? (
        <CardBody className="p-0">
          {decks.map((deck) => (
            <DeckPreview key={deck._id} deck={deck} />
          ))}
        </CardBody>
      ) : (
        <CardBody>
          No decks to show.
        </CardBody>
      )}
    </Card>
    {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/user/decks/${user._id}/${i}`} />}
  </UserLayout>
);

UserDecksPage.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool.isRequired,
  decks: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
};

export default UserDecksPage;
