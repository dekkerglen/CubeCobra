import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';

import { Flexbox } from '../base/Layout';
import Tag from '../base/Tag';
import Text from '../base/Text';

interface TagListProps {
  title: string;
  tags: string[];
  // Search filter keyword: `otag` or `atag`.
  filter: string;
}

// Slugs ship in Tagger order, which puts ancestors (`burn`) after their children
// (`burn-any`). Alphabetical keeps a family together and makes a given tag findable.
const TagList: React.FC<TagListProps> = ({ title, tags, filter }) => (
  <Flexbox direction="col" gap="2" className="p-4">
    <Text semibold>{title}</Text>
    {tags.length > 0 ? (
      <div className="-m-1 flex flex-wrap">
        {[...tags].sort().map((slug) => (
          <Tag
            key={slug}
            text={slug}
            // Quoted so a slug is always an exact tag match, never read as a tag count.
            href={`/tool/searchcards?f=${encodeURIComponent(`${filter}="${slug}"`)}`}
          />
        ))}
      </div>
    ) : (
      <Text sm className="text-text-secondary">{`No ${title.toLowerCase()}.`}</Text>
    )}
  </Flexbox>
);

interface CardBreakdownTagsProps {
  card: CardDetails;
}

// Oracle tags are shared by every printing; art tags belong to this printing's illustration.
const CardBreakdownTags: React.FC<CardBreakdownTagsProps> = ({ card }) => (
  <div className="flex flex-col divide-y divide-border">
    <TagList title="Oracle Tags" tags={card.oracle_tags ?? []} filter="otag" />
    <TagList title="Art Tags" tags={card.art_tags ?? []} filter="atag" />
  </div>
);

export default CardBreakdownTags;
