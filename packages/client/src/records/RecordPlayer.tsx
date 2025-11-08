import React from 'react';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import User from '@utils/datatypes/User';

const RecordPlayer: React.FC<{ name: string; userId?: string; user?: User }> = ({ name, userId, user }) => {
  if (userId && user) {
    return (
      <Flexbox direction="row" gap="2" alignItems="center">
        <a href={`/user/view/${user.id}`}>
          <img
            className="profile-thumbnail"
            src={user.image?.uri}
            alt={user.image?.artist}
            title={user.image?.artist}
          />
        </a>
        <Link key={userId} href={`/user/view/${userId}`}>
          <Text sm>{name}</Text>
        </Link>
      </Flexbox>
    );
  }

  // this shouldn't happen, but just in case
  if (userId) {
    return (
      <Flexbox direction="row" gap="2" alignItems="center">
        <a href={`/user/view/${userId}`}>
          <img
            className="profile-thumbnail"
            src="https://cards.scryfall.io/art_crop/front/3/7/37f9be6b-ae6e-4708-9749-83bebd351102.jpg?1736468284"
          />
        </a>
        <Link key={userId} href={`/user/view/${userId}`}>
          <Text sm>{name}</Text>
        </Link>
      </Flexbox>
    );
  }

  // Anonymous user
  return (
    <Flexbox direction="row" gap="2" alignItems="center">
      <img
        className="profile-thumbnail"
        src="https://cards.scryfall.io/art_crop/front/3/7/37f9be6b-ae6e-4708-9749-83bebd351102.jpg?1736468284"
      />
      <Text sm>{name}</Text>
    </Flexbox>
  );
};

export default RecordPlayer;
