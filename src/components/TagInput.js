import React from 'react';
import { WithContext as ReactTags } from 'react-tag-input';
import PropTypes from 'prop-types';

import { getTagColorClass } from 'utils/Util';

const TagInput = ({ tags, addTag, deleteTag, reorderTag, suggestions, tagColors }) => {
  return (
    <ReactTags
      tags={tags.map((tag) => ({ ...tag, className: getTagColorClass(tagColors, tag.text) }))}
      suggestions={suggestions.map((suggestion) => ({ id: suggestion, text: suggestion }))}
      handleAddition={addTag}
      handleDelete={deleteTag}
      handleDrag={reorderTag}
      placeholder="Tag (hit tab)..."
      maxLength={24}
      autofocus={false}
      classNames={{
        tags: 'flex-grow-1',
        tag: 'ReactTags__tag my-0',
        tagInput: 'ReactTags__tagInput m-0',
      }}
    />
  );
};

TagInput.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.shape({ text: PropTypes.string, id: PropTypes.string })).isRequired,
  addTag: PropTypes.func.isRequired,
  deleteTag: PropTypes.func.isRequired,
  reorderTag: PropTypes.func.isRequired,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  tagColors: PropTypes.arrayOf(PropTypes.shape({ tag: PropTypes.string, color: PropTypes.string })),
};

TagInput.defaultProps = {
  tagColors: [],
  suggestions: [],
};

export default TagInput;
