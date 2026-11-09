import React, { useMemo } from 'react';

import { XIcon } from '@primer/octicons-react';
import { filterToReadableString, makeFilter } from '@utils/filtering/FilterCards';
import classNames from 'classnames';

import { Card, CardBody, CardFooter } from 'components/base/Card';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';

// Section headers that decklist exports put between card lines; not cards.
const SECTION_HEADER = /^(deck|main ?deck|mainboard|sideboard|maybeboard|commander|companion)$/i;

const LIST_PLACEHOLDER = 'Lightning Bolt\nCounterspell\nLlanowar Elves';

// Every action button in the footer is the same width, so a spinner doesn't shrink it.
export const ACTION_BUTTON_CLASS = 'min-w-[8rem]';

/** How many cards a pasted list holds, counting "4 Name" / "4x Name" lines as four. */
export const countListCards = (text: string): number =>
  text.split(/\r?\n/).reduce((sum, raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#') || SECTION_HEADER.test(line.replace(/:$/, ''))) {
      return sum;
    }
    const match = line.match(/^(\d{1,4})[xX]?\s+\S/);
    return sum + (match ? Math.min(parseInt(match[1]!, 10), 100) : 1);
  }, 0);

interface PlaygroundFormProps {
  children: React.ReactNode;
  // Checkboxes, on the left of the footer.
  options?: React.ReactNode;
  // Buttons, on the right of the footer.
  actions: React.ReactNode;
}

/** The input card every playground tab opens with: fields, then options and actions in a footer. */
export const PlaygroundForm: React.FC<PlaygroundFormProps> = ({ children, options, actions }) => (
  <Card>
    <CardBody>
      <Flexbox direction="col" gap="3">
        {children}
      </Flexbox>
    </CardBody>
    <CardFooter>
      <Flexbox direction="row" justify="between" alignItems="center" gap="3" wrap="wrap" className="py-1">
        <Flexbox direction="row" alignItems="center" gap="4" wrap="wrap">
          {options}
        </Flexbox>
        <Flexbox direction="row" alignItems="center" gap="2" className="ml-auto">
          {actions}
        </Flexbox>
      </Flexbox>
    </CardFooter>
  </Card>
);

interface CardListInputProps {
  id: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
}

// Laid out like the base Input's label row, so list and single-line fields line up.
export const CardListInput: React.FC<CardListInputProps> = ({ id, label, value, setValue }) => {
  const count = useMemo(() => countListCards(value), [value]);
  return (
    <div className="block w-full">
      <Flexbox direction="row" justify="between" alignItems="center">
        <label htmlFor={id} className="block text-sm font-medium text-text">
          {label}
        </label>
        <span className="flex items-center gap-2 text-sm text-text-secondary tabular-nums">
          {count === 1 ? '1 card' : `${count.toLocaleString()} cards`}
          {/* Always laid out so the row keeps its height; hidden while there's nothing to clear. */}
          <button
            type="button"
            className={classNames('inline-flex items-center hover:text-text', { invisible: value.length === 0 })}
            onClick={() => setValue('')}
            aria-label={`Clear ${label}`}
            title="Clear"
            tabIndex={value.length === 0 ? -1 : undefined}
          >
            <XIcon size={14} />
          </button>
        </span>
      </Flexbox>
      <TextArea
        id={id}
        rows={10}
        value={value}
        placeholder={LIST_PLACEHOLDER}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
};

interface FilterFieldProps {
  id: string;
  value: string;
  setValue: (value: string) => void;
  onEnter?: () => void;
}

/** A card filter in the site's search syntax, checked as it is typed. */
export const FilterField: React.FC<FilterFieldProps> = ({ id, value, setValue, onEnter }) => {
  const parsed = useMemo(() => (value.trim().length > 0 ? makeFilter(value) : null), [value]);
  const valid = parsed ? !parsed.err && !!parsed.filter : undefined;

  return (
    <div className="block w-full">
      <Input
        id={id}
        label="Filter"
        link={{ href: '/wiki/reference/filter-syntax', text: 'Syntax guide' }}
        type="text"
        value={value}
        valid={valid}
        placeholder={'t:creature ci:wu'}
        onChange={(event) => setValue(event.target.value)}
        onEnter={onEnter}
        onClear={value.length > 0 ? () => setValue('') : undefined}
      />
      {valid && parsed?.filter && (
        <Text italic sm className="text-text-secondary mt-1 block">
          {filterToReadableString(parsed.filter)}
        </Text>
      )}
    </div>
  );
};

/** True when a filter is empty or parses; the playground only runs with a usable filter. */
export const isFilterUsable = (value: string): boolean => {
  if (value.trim().length === 0) return true;
  const { err, filter } = makeFilter(value);
  return !err && !!filter;
};
