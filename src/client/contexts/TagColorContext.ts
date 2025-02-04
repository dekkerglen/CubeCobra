import { createContext } from 'react';

import { TagColor } from '../../datatypes/Cube';

const TagColorContext = createContext<TagColor[]>([]);

export default TagColorContext;
