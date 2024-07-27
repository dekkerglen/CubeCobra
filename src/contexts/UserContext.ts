import User from 'datatypes/User';
import { createContext } from 'react';

export interface UserContextValue extends User {}

const UserContext = createContext<UserContextValue | null>(null);

export default UserContext;
