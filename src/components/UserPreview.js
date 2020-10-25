import React, { useCallback, useState } from 'react';
import UserPropType from 'proptypes/UserPropType';

import { Card } from 'reactstrap';

import AspectRatioBox from 'components/AspectRatioBox';

const UserPreview = ({ user }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback((event) => {
    window.location.href = event.currentTarget.getAttribute('data-href');
  }, []);
  const followers = user.users_following.length;
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      data-href={`/user/view/${user._id}`}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={626 / 457} className="text-ellipsis">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img className="w-100" src={user.image} />
        <em className="cube-preview-artist">Art by {user.artist}</em>
      </AspectRatioBox>
      <div className="w-100 py-1 px-2 text-muted text-truncate">
        <h5 className="mb-0">{user.username}</h5>
        {followers} {followers === 1 ? 'follower' : 'followers'}
      </div>
    </Card>
  );
};

UserPreview.propTypes = {
  user: UserPropType.isRequired,
};

export default UserPreview;
