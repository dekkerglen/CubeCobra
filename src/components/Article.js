import React from 'react';
import ArticlePropType from 'proptypes/ArticlePropType';

import Markdown from 'components/Markdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';

import { CardBody, CardHeader } from 'reactstrap';

const Article = ({ article }) => {
  return (
    <>
      <CardHeader>
        <h1>{article.title}</h1>
        <h6>
          By <a href={`/user/view/${article.owner}`}>{article.username}</a>
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
