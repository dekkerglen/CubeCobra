import React from 'react';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import { Tile } from 'components/base/Tile';
import MtgImage from 'components/MtgImage';
import Username from 'components/Username';
import User from 'datatypes/User';

interface UserPreviewProps {
  user: User;
}

const UserPreview: React.FC<UserPreviewProps> = ({ user }) => {
  const followers = (user.following || []).length;

  return (
    <Tile href={`/user/view/${user.id}`}>
      <Flexbox direction="col-reverse" className="max-h-full h-full">
        <Flexbox direction="col" className="p-1">
          <Text semibold lg className="truncate">
            <Username user={user} />
          </Text>
          <Text sm className="text-text-secondary truncate">
            {followers} {followers === 1 ? 'follower' : 'followers'}
          </Text>
        </Flexbox>
        <div className="overflow-hidden flex">
          <MtgImage image={user.image || { artist: '', uri: '' }} showArtist className="max-w-full self-center" />
        </div>
      </Flexbox>
    </Tile>
  );
};

export default UserPreview;
