import { createContext } from 'react';

interface ThemeContextValue {
  theme: string;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'default' });

export default ThemeContext;
