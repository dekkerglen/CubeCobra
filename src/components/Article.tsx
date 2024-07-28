import React from 'react';
import Content from 'datatypes/Content';
import Markdown from 'components/Markdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';
import Username from 'components/Username';
import { CardBody, CardHeader } from 'reactstrap';

interface ArticleProps {
  article: Content;
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
        <Markdown markdown={article.body} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="article" parent={article.id} collapse={false} />
      </div>
    </>
  );
};

export default Article;
