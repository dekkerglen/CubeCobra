import React, { useState, useRef } from 'react';

import TagData from 'datatypes/TagData';
import { getTagColorClass } from 'utils/Util';
import { Flexbox } from './base/Layout';
import Input from './base/Input';
import Tag from './base/Tag';
import classNames from 'classnames';

interface TagInputProps {
  tags: TagData[];
  addTag: (tag: TagData) => void;
  deleteTag: (i: number) => void;
  suggestions?: string[];
  tagColors?: { tag: string; color: string | null }[];
  readOnly?: boolean;
  label?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  addTag,
  deleteTag,
  suggestions = [],
  tagColors = [],
  readOnly = false,
  label,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState(-1);

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
    if (e.keyCode === 40) {
      // DOWN key
      e.preventDefault();
      setPosition((p) => (p < 9 ? p + 1 : p));
    } else if (e.keyCode === 38) {
      // UP key
      e.preventDefault();
      setPosition((p) => (p > -1 ? p - 1 : p));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleAddTag(suggestion);
    setPosition(-1);
    inputRef.current?.focus();
  };

  return (
    <Flexbox direction="col">
      {label && <label className="block text-sm font-medium text-text">{label}</label>}
      <Flexbox direction="row" gap="1" wrap="wrap" alignItems="center">
        {tags.map((tag, index) => (
          <Tag
            key={tag.id}
            text={tag.text}
            colorClass={getTagColorClass(tagColors, tag.text)}
            onDelete={() => handleDeleteTag(index)}
          />
        ))}
        {!readOnly && (
          <div className="flex-grow">
            <Input
              innerRef={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Tag (hit enter or tab)..."
              maxLength={24}
              autoFocus={false}
            />
            {filteredSuggestions.length > 0 && (
              <div
                className={classNames(
                  'absolute border border-border rounded-md top-0 left-0 translate-y-9 w-full flex flex-col overflow-y-visible z-[1050]',
                )}
              >
                {filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={classNames(
                      'list-none p-2 bg-bg-accent hover:bg-bg-active cursor-pointer',
                      { 'border-t border-border': index !== 0 },
                      { 'bg-bg-active': index === position },
                      { 'rounded-t-md': index === 0 },
                      { 'rounded-b-md': index === filteredSuggestions.length - 1 },
                    )}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Flexbox>
    </Flexbox>
  );
};

export default TagInput;
