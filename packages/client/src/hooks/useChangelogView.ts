import useLocalStorage from './useLocalStorage';

export type ChangelogView = 'text' | 'cards';

const useChangelogView = (): [ChangelogView, (view: ChangelogView) => void] => {
  const [view, setView] = useLocalStorage<ChangelogView>('changelogView', 'cards');
  return [view === 'text' ? 'text' : 'cards', setView];
};

export default useChangelogView;
