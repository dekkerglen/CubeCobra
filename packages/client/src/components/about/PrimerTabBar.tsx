import React, { useRef } from 'react';

import { PrimerTab } from '@utils/primerTabs';
import classNames from 'classnames';

export const UNTITLED_LABEL = '(untitled)';
export const TAB_PANEL_ID = 'primer-tabpanel';

export const isUntitledTab = (tab?: PrimerTab): boolean => !tab || tab.title.trim().length === 0;

export const tabLabel = (tab: PrimerTab): string => (isUntitledTab(tab) ? UNTITLED_LABEL : tab.title);

export const tabButtonClassName = (isActive: boolean, isUntitled: boolean): string =>
  classNames(
    'px-2 md:px-4 py-2 text-sm md:text-base font-medium focus:outline-none transition-colors duration-300 box-border',
    {
      'border-b-2 border-button-primary': isActive,
      'border-b-2 border-transparent': !isActive,
      'text-text': isActive && !isUntitled,
      'text-button-primary hover:text-button-primary-active': !isActive && !isUntitled,
      'italic text-text-secondary': isUntitled,
    },
  );

interface PrimerTabBarProps {
  tabs: PrimerTab[];
  selected: number;
  onSelect: (index: number) => void;
}

const PrimerTabBar: React.FC<PrimerTabBarProps> = ({ tabs, selected, onSelect }) => {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (tabs.length <= 1) {
    return null;
  }

  const moveTo = (index: number) => {
    onSelect(index);
    buttonRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const last = tabs.length - 1;
    switch (event.key) {
      case 'ArrowRight':
        moveTo(selected === last ? 0 : selected + 1);
        break;
      case 'ArrowLeft':
        moveTo(selected === 0 ? last : selected - 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(last);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className="flex flex-row flex-wrap items-end border-b border-border">
      <div role="tablist" className="flex flex-row flex-wrap items-end" onKeyDown={handleKeyDown}>
        {tabs.map((tab, index) => {
          const isActive = index === selected;
          return (
            <button
              key={index}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              id={`primer-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={TAB_PANEL_ID}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(index)}
              className={tabButtonClassName(isActive, isUntitledTab(tab))}
            >
              {tabLabel(tab)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PrimerTabBar;
