import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';
import VideoPropType from 'proptypes/VideoPropType';

import { CardHeader, Card } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Video from 'components/Video';
import ButtonLink from 'components/ButtonLink';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const VideoPage = ({ user, loginCallback, video }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <DynamicFlash />
      <Card className="mb-3">
        {user && user.id === video.owner && video.status !== 'published' && (
          <CardHeader>
            <h5>
              <em className="pr-3">*Draft*</em>
              <ButtonLink color="success" outline href={`/content/video/edit/${video._id}`}>
                Edit
              </ButtonLink>
            </h5>
          </CardHeader>
        )}
        <Video video={video} userid={user && user.id} />
      </Card>
    </MainLayout>
  );
};

VideoPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  video: VideoPropType.isRequired,
};

VideoPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(VideoPage);
