import React from 'react';

import { WithContext as ReactTags } from 'react-tag-input';

import TagData from 'datatypes/TagData';
import { getTagColorClass } from 'utils/Util';

interface TagInputProps {
  tags: TagData[];
  addTag: (tag: TagData) => void;
  deleteTag: (i: number) => void;
  reorderTag: (tag: TagData, currPos: number, newPos: number) => void;
  suggestions?: string[];
  tagColors?: { tag: string; color: string | null }[];
  readOnly?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  addTag,
  deleteTag,
  reorderTag,
  suggestions = [],
  tagColors = [],
  readOnly = false,
}) => {
  // Need type assertions here as the typing for ReactTags is not very good.
  return (
    <ReactTags
      tags={tags.map((tag) => ({ ...tag, className: getTagColorClass(tagColors, tag.text) }))}
      suggestions={suggestions.map((suggestion) => ({ id: suggestion, text: suggestion })) as any}
      handleAddition={((tag: TagData) => addTag({ text: tag.text, id: tag.id })) as any}
      handleDelete={deleteTag}
      handleDrag={
        ((tag: TagData, currPos: number, newPos: number) =>
          reorderTag({ text: tag.text, id: tag.id }, currPos, newPos)) as any
      }
      placeholder="Tag (hit tab)..."
      maxLength={24}
      autofocus={false}
      readOnly={readOnly}
      classNames={
        {
          tags: 'flex-grow-1',
          tag: 'ReactTags__tag my-0',
          tagInput: 'ReactTags__tagInput m-0',
        } as any
      }
    />
  );
};

export default TagInput;
