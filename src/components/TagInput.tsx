import React, { useState, useRef } from 'react';

import TagData from 'datatypes/TagData';
import { getTagColorClass } from 'utils/Util';

interface TagInputProps {
  tags: TagData[];
  addTag: (tag: TagData) => void;
  deleteTag: (i: number) => void;
  suggestions?: string[];
  tagColors?: { tag: string; color: string | null }[];
  readOnly?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  addTag,
  deleteTag,
  suggestions = [],
  tagColors = [],
  readOnly = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setFilteredSuggestions(suggestions.filter((suggestion) => suggestion.toLowerCase().includes(value.toLowerCase())));
  };

  const handleAddTag = (tagText: string) => {
    if (tagText.trim() !== '') {
      addTag({ text: tagText, id: tagText });
      setInputValue('');
      setFilteredSuggestions([]);
    }
  };

  const handleDeleteTag = (index: number) => {
    deleteTag(index);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleAddTag(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className="tag-input">
      <div className="tags flex-grow-1 flex-wrap">
        {tags.map((tag, index) => (
          <div key={tag.id} className={`ReactTags__tag my-0 ${getTagColorClass(tagColors, tag.text)}`}>
            {tag.text}
            {!readOnly && (
              <button type="button" onClick={() => handleDeleteTag(index)}>
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="tag-input-field">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Tag (hit enter or tab)..."
            maxLength={24}
            autoFocus={false}
          />
          {filteredSuggestions.length > 0 && (
            <ul className="suggestions">
              {filteredSuggestions.map((suggestion, index) => (
                <li key={index} onClick={() => handleSuggestionClick(suggestion)}>
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default TagInput;
