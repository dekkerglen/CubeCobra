import useLocalStorage from './useLocalStorage';

export type ChangelogView = 'text' | 'cards';

const useChangelogView = (): [ChangelogView, (view: ChangelogView) => void] =>
  useLocalStorage<ChangelogView>('changelogView', 'cards');

export default useChangelogView;
