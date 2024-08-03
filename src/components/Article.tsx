import React from 'react';
import { CardBody, CardHeader } from 'reactstrap';

import TimeAgo from 'react-timeago';

import CommentsSection from 'components/CommentsSection';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import ArticleData from 'datatypes/Article';

export interface ArticleProps {
  article: ArticleData;
}

const Article: React.FC<ArticleProps> = ({ article }) => {
  return (
    <>
      <CardHeader>
        <h1>{article.title}</h1>
        <h6>
          By <Username user={article.owner} />
          {' | '}
          <TimeAgo date={article.date} />
        </h6>
      </CardHeader>
      <CardBody>
        <Markdown markdown={article.body ?? ''} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="article" parent={article.id} collapse={false} />
      </div>
    </>
  );
};

export default Article;
