import React from 'react';
import PropTypes from 'prop-types';

import MagicMarkdown from 'components/MagicMarkdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';

import ReactPlayer from 'react-player';

import { Row, Card, CardBody, CardHeader } from 'reactstrap';

const Video = ({ video, userid }) => {
  const markdownStr = video.body.toString();
  const split = markdownStr.split(/(<<.+>>|(?:^> .{0,}\r?\n)+)/gm);

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
        {split.map((section) => {
          if (section.startsWith('<<')) {
            const sub = section.substring(2, section.length - 2);
            return (
              <Row>
                <MagicMarkdown markdown={sub} />
              </Row>
            );
          }
          if (section.startsWith('> ')) {
            console.log(section);
            const lines = section.split(/(> .+\r?\n)/gm).filter((line) => line.length > 0);
            console.log(lines);
            return (
              <Card className="bg-light">
                <CardBody>
                  {lines.map((line) => (
                    <MagicMarkdown markdown={line.substring(2)} />
                  ))}
                </CardBody>
              </Card>
            );
          }
          return <MagicMarkdown markdown={section} />;
        })}
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="video" parent={video._id} userid={userid} collapse={false} />
      </div>
    </>
  );
};
Video.propTypes = {
  video: PropTypes.shape({
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  }).isRequired,
  userid: PropTypes.string,
};

Video.defaultProps = {
  userid: null,
};

export default Video;
