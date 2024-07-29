import { createContext } from 'react';

export interface TagColor {
  tag: string;
  color: string;
}

const TagColorContext = createContext<TagColor[]>([]);

export default TagColorContext;
