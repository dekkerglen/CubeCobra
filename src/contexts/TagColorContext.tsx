import React, { createContext } from 'react';

interface TagColor {
  tag: string;
  color: string;
}

interface TagColorContextValue {
  tagColors: TagColor[];
}

const TagColorContext = createContext<TagColorContextValue | undefined>(undefined);

export default TagColorContext;
