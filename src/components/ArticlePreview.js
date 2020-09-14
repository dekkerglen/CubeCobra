import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { Card } from 'reactstrap';
import AspectRatioBox from 'components/AspectRatioBox';
import TimeAgo from 'react-timeago';

const ArticlePreview = ({ article }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback(
    (event) => {
      if (!event.target.getAttribute('data-sublink')) {
        window.location.href = `/content/article/${article._id}`;
      }
    },
    [article],
  );
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={626 / 457} className="text-ellipsis">
        <img className="w-100" alt={article.title} src={article.image} />
        <em className="cube-preview-artist">Art by {article.artist}</em>
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <h5 className="text-muted text-ellipsis my-0">{article.title}</h5>
        <small>
          <em className="text-muted text-ellipsis">
            Written by{' '}
            <a data-sublink href={`/user/view/${article.owner}`}>
              {article.username}
            </a>
            {' | '}
            <TimeAgo date={article.date} />
          </em>
        </small>
      </div>
    </Card>
  );
};

ArticlePreview.propTypes = {
  article: PropTypes.shape({
    title: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
  }).isRequired,
};
export default ArticlePreview;
