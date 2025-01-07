import { createContext } from 'react';

import User from '../datatypes/User';

export interface UserContextValue extends User {}

const UserContext = createContext<UserContextValue | null>(null);

export default UserContext;
