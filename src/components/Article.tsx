import React from 'react';

import TimeAgo from 'react-timeago';

import CommentsSection from 'components/CommentsSection';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import ArticleData from 'datatypes/Article';
import { CardBody, CardHeader } from './base/Card';
import Text from './base/Text';
import { Flexbox } from './base/Layout';

export interface ArticleProps {
  article: ArticleData;
}

const Article: React.FC<ArticleProps> = ({ article }) => {
  return (
    <>
      <CardHeader>
        <Flexbox direction="col" justify="between">
          <Text xxl semibold>
            {article.title}
          </Text>
          <Text md>
            By <Username user={article.owner} />
            {' | '}
            <TimeAgo date={article.date} />
          </Text>
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Markdown markdown={article.body ?? ''} />
      </CardBody>
      <div className="border-t border-border">
        <CommentsSection parentType="article" parent={article.id} collapse={false} />
      </div>
    </>
  );
};

export default Article;
