import React, { useRef, useState } from 'react';

import { arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { GrabberIcon, XIcon } from '@primer/octicons-react';
import {
  nextNewTabTitle,
  PRIMER_MAX_TABS,
  PRIMER_MAX_TITLE_LENGTH,
  PRIMER_MAX_TOTAL_CHARS,
  PrimerTab,
  totalPrimerLength,
} from '@utils/primerTabs';
import classNames from 'classnames';

import { isUntitledTab, tabButtonClassName, tabLabel } from 'components/about/PrimerTabBar';
import { selectedAfterMove, selectedAfterRemove } from 'components/about/primerTabSelection';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import { SortableItem, SortableList } from 'components/DND';
import TextEntry from 'components/TextEntry';

interface PrimerTabsEditorProps {
  tabs: PrimerTab[];
  setTabs: (tabs: PrimerTab[]) => void;
  selected: number;
  setSelected: (index: number) => void;
}

const PrimerTabsEditor: React.FC<PrimerTabsEditorProps> = ({ tabs, setTabs, selected, setSelected }) => {
  const nextKey = useRef(0);
  const makeKey = () => `primer-tab-${nextKey.current++}`;
  // Sortable ids only; never sent to the server.
  const [keys, setKeys] = useState<string[]>(() => tabs.map(makeKey));

  const selectedTab = tabs[selected];
  const total = totalPrimerLength(tabs);
  const overLimit = total > PRIMER_MAX_TOTAL_CHARS;
  const selectedTitleBlank = !!selectedTab && isUntitledTab(selectedTab);

  const updateSelected = (patch: Partial<PrimerTab>) =>
    setTabs(tabs.map((tab, index) => (index === selected ? { ...tab, ...patch } : tab)));

  const addTab = () => {
    setTabs([...tabs, { title: nextNewTabTitle(tabs), content: '' }]);
    setKeys([...keys, makeKey()]);
    setSelected(tabs.length);
  };

  const removeTab = (index: number) => {
    const tab = tabs[index];
    if (!tab) {
      return;
    }
    if (tab.content.length > 0 && !window.confirm(`Remove tab "${tabLabel(tab)}"? Its content will be lost.`)) {
      return;
    }
    setTabs(tabs.filter((_, i) => i !== index));
    setKeys(keys.filter((_, i) => i !== index));
    setSelected(selectedAfterRemove(selected, index, tabs.length - 1));
  };

  const handleDragEnd = ({ active, over }: { active: { id: string }; over: { id: string } | null }) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = keys.indexOf(active.id);
    const to = keys.indexOf(over.id);
    if (from < 0 || to < 0) {
      return;
    }
    setTabs(arrayMove(tabs, from, to));
    setKeys(arrayMove(keys, from, to));
    setSelected(selectedAfterMove(selected, from, to));
  };

  return (
    <Flexbox direction="col" gap="2" className="px-2">
      <div className="flex flex-row flex-wrap items-end border-b border-border">
        <SortableList items={keys} onDragEnd={handleDragEnd} strategy={rectSortingStrategy}>
          <div role="list" aria-label="Primer tabs" className="flex flex-row flex-wrap items-end">
            {tabs.map((tab, index) => {
              const isActive = index === selected;
              const untitled = isUntitledTab(tab);
              return (
                <SortableItem
                  key={keys[index] ?? index}
                  id={keys[index] ?? String(index)}
                  className="no-touch-action"
                  role="listitem"
                >
                  {({ handleProps }) => (
                    <div className="flex flex-row items-center">
                      <span {...handleProps} role="img" className="cursor-grab" aria-label="Drag to reorder">
                        <GrabberIcon size={16} />
                      </span>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setSelected(index)}
                        className={tabButtonClassName(isActive, untitled)}
                      >
                        {tabLabel(tab)}
                      </button>
                      {tabs.length > 1 && (
                        <button
                          type="button"
                          aria-label={untitled ? 'Remove untitled tab' : `Remove tab ${tab.title}`}
                          onClick={() => removeTab(index)}
                          className="p-1 text-text-secondary hover:text-text"
                        >
                          <XIcon size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </SortableItem>
              );
            })}
          </div>
        </SortableList>
        <Button
          color="primary"
          outline
          disabled={tabs.length >= PRIMER_MAX_TABS}
          onClick={addTab}
          className="ml-2 mb-1"
        >
          + Add tab
        </Button>
      </div>

      <Input
        id="primer-tab-title"
        label="Tab title"
        value={selectedTab?.title ?? ''}
        onChange={(event) => updateSelected({ title: event.target.value })}
        otherInputProps={{ maxLength: PRIMER_MAX_TITLE_LENGTH }}
      />
      {selectedTitleBlank && (
        <Text sm className="text-red-500">
          Title required
        </Text>
      )}

      <TextEntry
        name="description"
        value={selectedTab?.content ?? ''}
        setValue={(content: string) => updateSelected({ content })}
        maxLength={PRIMER_MAX_TOTAL_CHARS}
        showCharacterLimit={false}
        rows={20}
      />

      <Flexbox direction="row" gap="4" wrap="wrap">
        <Text sm className={classNames({ 'text-red-500': overLimit })}>
          {`${total.toLocaleString('en-US')} / ${PRIMER_MAX_TOTAL_CHARS.toLocaleString('en-US')} characters (all tabs)`}
        </Text>
        <Text sm>{`${tabs.length} / ${PRIMER_MAX_TABS} tabs`}</Text>
      </Flexbox>
      {overLimit && (
        <Text sm className="text-red-500">
          Over the limit — shorten the primer before saving.
        </Text>
      )}
    </Flexbox>
  );
};

export default PrimerTabsEditor;
