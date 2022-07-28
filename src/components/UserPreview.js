import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import { Card } from 'reactstrap';

import AspectRatioBox from 'components/AspectRatioBox';
import Username from 'components/Username';
import MtgImage from 'components/MtgImage';

const UserPreview = ({ user }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback((event) => {
    window.location.href = event.currentTarget.getAttribute('data-href');
  }, []);

  const followers = (user.UsersFollowing || []).length;
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      data-href={`/user/view/${user.Id}`}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={626 / 457} className="text-ellipsis">
        <MtgImage cardname={user.ImageName} showArtist />
      </AspectRatioBox>
      <div className="w-100 py-1 px-2 text-muted text-truncate">
        <h5 className="mb-0">
          <Username userId={user.Id} defaultName={user.Username} />
        </h5>
        {followers} {followers === 1 ? 'follower' : 'followers'}
      </div>
    </Card>
  );
};

UserPreview.propTypes = {
  user: PropTypes.shape({
    Id: PropTypes.string.isRequired,
    Username: PropTypes.string.isRequired,
    Image: PropTypes.string.isRequired,
    Artist: PropTypes.string.isRequired,
    UsersFollowing: PropTypes.arrayOf(PropTypes.string.isRequired),
    ImageName: PropTypes.string.isRequired,
  }).isRequired,
};

export default UserPreview;
