import { useContext } from 'react';
import { ThemeContext } from './theme-context';

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme harus digunakan di dalam ThemeProvider.');
  return value;
}
