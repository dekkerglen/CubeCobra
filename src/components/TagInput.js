import React, { useContext } from 'react';
import { WithContext as ReactTags } from 'react-tag-input';
import PropTypes from 'prop-types';

import TagContext from 'contexts/TagContext';

const TagInput = ({ tags, addTag, deleteTag, reorderTag, dontAddSuggestions, ...props }) => {
  const { allSuggestions, addSuggestion, tagColorClass } = useContext(TagContext);
  return (
    <ReactTags
      tags={tags.map((tag) => ({ ...tag, className: tagColorClass(tag.text) }))}
      suggestions={allSuggestions}
      handleAddition={(tag) => {
        if (!dontAddSuggestions) {
          addSuggestion(tag);
        }
        addTag(tag);
      }}
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
      {...props}
    />
  );
};

TagInput.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.shape({ text: PropTypes.string, id: PropTypes.string })).isRequired,
  addTag: PropTypes.func.isRequired,
  deleteTag: PropTypes.func.isRequired,
  reorderTag: PropTypes.func.isRequired,
  dontAddSuggestions: PropTypes.bool,
};
TagInput.defaultProps = {
  dontAddSuggestions: false,
};

export default TagInput;
