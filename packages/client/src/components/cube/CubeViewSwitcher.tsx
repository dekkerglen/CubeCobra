import React, { useContext } from 'react';

import { GraphIcon, IconProps, ImageIcon, ListUnorderedIcon, StackIcon, TableIcon } from '@primer/octicons-react';

import { NumCols } from 'components/base/Layout';
import UserContext from 'contexts/UserContext';

import Select from '../base/Select';
import Tooltip from '../base/Tooltip';

interface ViewOption {
  key: string;
  label: string;
  tooltip: string;
  Icon: React.FC<IconProps>;
}

const VIEWS: ViewOption[] = [
  { key: 'table', label: 'Table', tooltip: 'Table View', Icon: TableIcon },
  { key: 'spoiler', label: 'Visual Spoiler', tooltip: 'Visual Spoiler', Icon: ImageIcon },
  { key: 'curve', label: 'Curve', tooltip: 'Curve View', Icon: GraphIcon },
  { key: 'stacks', label: 'Stacks', tooltip: 'Card Stacks', Icon: StackIcon },
];

const LIST_VIEW: ViewOption = { key: 'list', label: 'List', tooltip: 'List View', Icon: ListUnorderedIcon };

interface CubeViewSwitcherProps {
  view: string;
  setView: (view: string) => void;
  includeList?: boolean;
  compact?: boolean;
}

const CubeViewSwitcher: React.FC<CubeViewSwitcherProps> = ({ view, setView, includeList = false, compact = false }) => {
  const user = useContext(UserContext);
  const views = includeList ? [...VIEWS, LIST_VIEW] : VIEWS;

  if (user?.useTextOverIcons) {
    return (
      <div className={compact ? 'flex-1 min-w-0' : 'w-40'}>
        <Select
          value={view}
          setValue={setView}
          className="bg-bg-active"
          options={views.map(({ key, label }) => ({ value: key, label }))}
        />
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'flex gap-0 bg-bg-active rounded py-0.5 items-center'
          : 'flex gap-0 bg-bg-active rounded py-0.5 px-1 self-stretch items-center'
      }
    >
      {views.map(({ key, tooltip, Icon }) => (
        <Tooltip key={key} text={tooltip}>
          <button
            onClick={() => setView(key)}
            className={`px-2 py-1 rounded transition-colors ${view === key ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
            aria-label={tooltip}
            aria-pressed={view === key}
          >
            <Icon size={compact ? 16 : 20} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
};

interface PerRowSelectProps {
  value: NumCols;
  setValue: (n: NumCols) => void;
  className?: string;
}

const perRowOptions = (max: number, singular: string, plural: string) =>
  Array.from({ length: max }, (_, i) => ({
    value: `${i + 1}`,
    label: `${i + 1} ${i === 0 ? singular : plural} Per Row`,
  }));

const CARDS_PER_ROW_OPTIONS = perRowOptions(12, 'Card', 'Cards');
const STACKS_PER_ROW_OPTIONS = perRowOptions(4, 'Stack', 'Stacks');

export const CardsPerRowSelect: React.FC<PerRowSelectProps> = ({ value, setValue, className = 'bg-bg-active' }) => (
  <Select
    value={`${value}`}
    setValue={(v) => setValue(parseInt(v, 10) as NumCols)}
    className={className}
    options={CARDS_PER_ROW_OPTIONS}
  />
);

export const StacksPerRowSelect: React.FC<PerRowSelectProps> = ({ value, setValue, className = 'bg-bg-active' }) => (
  <Select
    value={`${value}`}
    setValue={(v) => setValue(parseInt(v, 10) as NumCols)}
    className={className}
    options={STACKS_PER_ROW_OPTIONS}
  />
);

export default CubeViewSwitcher;
