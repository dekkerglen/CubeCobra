import React from 'react';
import { WithContext as ReactTags } from 'react-tag-input';

import TagContext from './TagContext';

const TagInput = ({ tags, addTag, deleteTag, reorderTag, ...props }) => (
  <TagContext.Consumer>
    {({ allSuggestions, addSuggestion, tagColorClass }) => (
      <ReactTags
        tags={tags.map((tag) => ({ ...tag, className: tagColorClass(tag.text) }))}
        suggestions={allSuggestions}
        handleAddition={(tag) => {
          addSuggestion(tag);
          addTag(tag);
        }}
        handleDelete={deleteTag}
        handleDrag={reorderTag}
        placeholder="Tag (hit tab)..."
        maxLength={24}
        autofocus={false}
        classNames={{
          tags: 'flex-grow-1',
        }}
        {...props}
      />
    )}
  </TagContext.Consumer>
);

export default TagInput;
