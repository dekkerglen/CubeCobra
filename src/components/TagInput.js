import React from 'react';
import { WithContext as ReactTags } from 'react-tag-input';

import TagContext from './TagContext';

const TagInput = ({ tags, addTag, deleteTag, reorderTag }) => (
  <TagContext.Consumer>
    {({ allSuggestions, addSuggestion }) => (
      <ReactTags
        tags={tags}
        suggestions={allSuggestions}
        handleAddition={tag => { addSuggestion(tag); addTag(tag); }}
        handleDelete={deleteTag}
        handleDrag={reorderTag}
        placeholder="Tag..."
        maxLength={24}
        autofocus={false}
      />
    )}
  </TagContext.Consumer>
);

export default TagInput;
