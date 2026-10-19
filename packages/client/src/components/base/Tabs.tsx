import React, { useState } from 'react';

import classNames from 'classnames';

import { Flexbox } from './Layout';

interface Tab {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: number;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, className }) => {
  return (
    <Flexbox direction="row" className={className} wrap="wrap" alignItems="end">
      {tabs.map((tab, index) => {
        const isActive = activeTab === index;
        const commonClasses = classNames(
          'px-2 md:px-4 py-2 font-medium focus:outline-none transition-colors duration-300',
          'text-sm md:text-base', // Small text on small screens, medium text on larger screens
          'box-border', // Ensure border doesn't affect the size
          {
            'border-b-2 border-button-primary text-text': isActive,
            'border-transparent hover:text-button-primary text-button-primary hover:text-button-primary-active':
              !isActive,
          },
        );

        return tab.href ? (
          <a key={index} href={tab.href} className={commonClasses}>
            {tab.label}
          </a>
        ) : (
          <button
            key={index}
            className={commonClasses}
            onClick={(e) => {
              e.preventDefault();
              if (tab.onClick) {
                tab.onClick();
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </Flexbox>
  );
};

interface TabContentProps {
  activeTab: number;
  contents: React.ReactNode[];
  className?: string;
}

export const TabContent: React.FC<TabContentProps> = ({ activeTab, contents, className = '' }) => {
  // Tabs mount on first visit and stay mounted afterwards, so returning to one is
  // instant and any state it holds survives, while a tab the user never opens costs
  // nothing. Mounting every tab up front meant the card page fetched two thirds of
  // its card images, and fired the combos request, for tabs nobody looked at.
  const [visited, setVisited] = useState<number[]>(() => [activeTab]);

  // Recorded during render rather than in an effect so the tab counts as mounted on
  // the same pass that reveals it, with no intermediate frame of empty content.
  if (!visited.includes(activeTab)) {
    setVisited([...visited, activeTab]);
  }

  return (
    <div className={className}>
      {contents.map((content, index) => (
        <div
          key={index}
          className={classNames('max-w-full', { block: index === activeTab, hidden: index !== activeTab })}
        >
          {index === activeTab || visited.includes(index) ? content : null}
        </div>
      ))}
    </div>
  );
};

interface TabPage extends Tab {
  content: React.ReactNode;
}

interface TabbedViewProps {
  activeTab: number;
  tabs: TabPage[];
}

export const TabbedView: React.FC<TabbedViewProps> = ({ activeTab, tabs }) => {
  return (
    <div>
      <Tabs tabs={tabs} activeTab={activeTab} className="mt-2 border-b border-border" />
      <TabContent activeTab={activeTab} contents={tabs.map((tab) => tab.content)} />
    </div>
  );
};
