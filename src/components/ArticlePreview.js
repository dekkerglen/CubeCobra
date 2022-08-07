import React, { useState, useCallback } from 'react';
import ContentPropType from 'proptypes/ContentPropType';

import { Card } from 'reactstrap';
import AspectRatioBox from 'components/AspectRatioBox';
import TimeAgo from 'react-timeago';
import Username from 'components/Username';
import MtgImage from 'components/MtgImage';

const ArticlePreview = ({ article }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={2} className="text-ellipsis">
        <MtgImage cardname={article.ImageName} />
        <h6 className="content-preview-banner article-preview-bg">
          <strong>Article</strong>
        </h6>
      </AspectRatioBox>
      <div className="w-100 pt-1 pb-1 px-2">
        <a href={`/content/article/${article.Id}`} className="stretched-link">
          <h6 className="text-muted text-ellipsis mt-0 mb-0 pb-1">{article.Title}</h6>
        </a>
        <small>
          <p className="mb-0">{article.Short}</p>
        </small>
      </div>
      <div className={`w-100 pb-1 pt-0 px-2 m-0 ${hover ? 'preview-footer-bg-hover' : 'preview-footer-bg'}`}>
        <small className="float-start">
          Written by <Username userId={article.Owner} defaultName={article.Username} />
        </small>
        <small className="float-end">
          <TimeAgo date={article.Date} />
        </small>
      </div>
    </Card>
  );
};

ArticlePreview.propTypes = {
  article: ContentPropType.isRequired,
};
export default ArticlePreview;
