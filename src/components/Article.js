import React from 'react';
import ArticlePropType from 'proptypes/ArticlePropType';

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
          By <Username userId={article.owner} defaultName={article.username} />
          {' | '}
          <TimeAgo date={article.date} />
        </h6>
      </CardHeader>
      <CardBody>
        <Markdown markdown={article.body} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="article" parent={article._id} collapse={false} />
      </div>
    </>
  );
};
Article.propTypes = {
  article: ArticlePropType.isRequired,
};

export default Article;
