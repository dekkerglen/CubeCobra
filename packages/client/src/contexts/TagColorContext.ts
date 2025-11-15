import { createContext } from 'react';

import { TagColor } from '@utils/datatypes/Cube';

const TagColorContext = createContext<TagColor[]>([]);

export default TagColorContext;
