import React from 'react';
import PropTypes from 'prop-types';

import MagicMarkdown from 'components/MagicMarkdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';

import ReactPlayer from 'react-player';

import { Row, Card, CardBody, CardHeader } from 'reactstrap';

const Video = ({ video, userid }) => {
  const markdownStr = video.body.toString();
  const split = markdownStr.split(/(<<.+>>|#{1,6} .+\r?\n|(?:1\. .+\r?\n)+|(?:- .+\r?\n)+|(?:> .{0,}\r?\n)+)/gm);

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
        {split.map((markdown) => {
          if (markdown.startsWith('1. ')) {
            const lines = markdown.split(/(1\. .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ol>
                {lines.map((line) => (
                  <li>
                    <MagicMarkdown markdown={line.substring(3)} />
                  </li>
                ))}
              </ol>
            );
          }
          if (markdown.startsWith('- ')) {
            const lines = markdown.split(/(- .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ul>
                {lines.map((line) => (
                  <li>
                    <MagicMarkdown markdown={line.substring(2)} />
                  </li>
                ))}
              </ul>
            );
          }
          if (markdown.startsWith('> ')) {
            console.log(markdown);
            const lines = markdown.split(/(> .+\r?\n)/gm).filter((line) => line.length > 0);
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
          if (markdown.startsWith('# ')) {
            return <h1>{markdown.substring(2)}</h1>;
          }
          if (markdown.startsWith('## ')) {
            return <h2>{markdown.substring(3)}</h2>;
          }
          if (markdown.startsWith('### ')) {
            return <h3>{markdown.substring(4)}</h3>;
          }
          if (markdown.startsWith('#### ')) {
            return <h4>{markdown.substring(5)}</h4>;
          }
          if (markdown.startsWith('##### ')) {
            return <h5>{markdown.substring(6)}</h5>;
          }
          if (markdown.startsWith('###### ')) {
            return <h6>{markdown.substring(7)}</h6>;
          }
          if (markdown.startsWith('<<')) {
            const sub = markdown.substring(2, markdown.length - 2);
            return (
              <Row>
                <MagicMarkdown markdown={sub} />
              </Row>
            );
          }
          return <MagicMarkdown markdown={markdown} />;
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
