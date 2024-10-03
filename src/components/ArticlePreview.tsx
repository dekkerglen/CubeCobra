import React from 'react';

import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/AspectRatioBox';
import MtgImage from 'components/MtgImage';
import Username from 'components/Username';
import Article from 'datatypes/Article';
import Text from './base/Text';
import { Tile } from './base/Tile';
import { Flexbox } from './base/Layout';

const statusMap: Record<string, string> = {
  p: 'Published',
  d: 'Draft',
  r: 'In Review',
};

export interface ArticlePreviewProps {
  article: Article;
  showStatus?: boolean;
}

const ArticlePreview: React.FC<ArticlePreviewProps> = ({ article, showStatus = false }) => {
  return (
    <Tile href={`/content/article/${article.id}`}>
      <AspectRatioBox ratio={1.9}>
        {article.image && <MtgImage image={article.image} />}
        <Text bold className="absolute bottom-0 left-0 text-text bg-article bg-opacity-50 w-full mb-0 p-1">
          Article
        </Text>
      </AspectRatioBox>
      <Flexbox direction="col" className="p-1 flex-grow">
        <Text semibold md className="truncate">
          {article.title}
        </Text>
        <Flexbox direction="row" justify="between">
          <Text xs className="text-text-secondary">
            Written by <Username user={article.owner} />
          </Text>
          <Text xs className="text-text-secondary">
            <TimeAgo date={article.date} />
          </Text>
        </Flexbox>
        <div className="flex-grow">
          <Text area xs>
            {article.short}
            {article.short}
            {article.short}
            {article.short}
          </Text>
        </div>
        {showStatus && (
          <div className={`w-100 pb-1 pt-0 px-2 m-0`}>
            <small className="float-start">Status: {statusMap[article.status]}</small>
          </div>
        )}
      </Flexbox>
    </Tile>
  );
};

export default ArticlePreview;
