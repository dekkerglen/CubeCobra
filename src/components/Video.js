import React from 'react';
import PropTypes from 'prop-types';
import VideoPropType from 'proptypes/VideoPropType';

import Markdown from 'components/Markdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';

import ReactPlayer from 'react-player';

import { CardBody, CardHeader } from 'reactstrap';

const Video = ({ video, userid }) => {
  return (
    <>
      <CardHeader>
        <h1>{video.title}</h1>
        <h6>
          By <a href={`/user/view/${video.owner}`}>{video.username}</a>
          {' | '}
          <TimeAgo date={video.date} />
        </h6>
      </CardHeader>
      <CardBody>
        <div className="player-wrapper">
          <ReactPlayer className="react-player" url={video.url} width="100%" height="100%" />
        </div>
      </CardBody>
      <CardBody>
        <Markdown markdown={video.body} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="video" parent={video._id} userid={userid} collapse={false} />
      </div>
    </>
  );
};
Video.propTypes = {
  video: VideoPropType.isRequired,
  userid: PropTypes.string,
};

Video.defaultProps = {
  userid: null,
};

export default Video;
