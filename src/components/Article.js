import React from 'react';
import ContentPropType from 'proptypes/ContentPropType';

import Markdown from 'components/Markdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';
import Username from 'components/Username';

import { CardBody, CardHeader } from 'reactstrap';

const Article = ({ article }) => {
  return (
    <>
      <CardHeader>
        <h1>{article.title}</h1>
        <h6>
          By <Username user={article.owner} defaultName={article.username} />
          {' | '}
          <TimeAgo date={article.date} />
        </h6>
      </CardHeader>
      <CardBody>
        <Markdown markdown={article.body} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="article" parent={article.id} collapse={false} />
      </div>
    </>
  );
};
Article.propTypes = {
  article: ContentPropType.isRequired,
};

export default Article;
