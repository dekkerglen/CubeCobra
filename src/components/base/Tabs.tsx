import React from 'react';
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
    <Flexbox direction="row" className={className} wrap="wrap">
      {tabs.map((tab, index) => {
        const isActive = activeTab === index;
        const commonClasses = classNames(
          'px-2 md:px-8 py-2 text-md font-medium focus:outline-none transition-colors duration-300',
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
  return (
    <div className={className}>
      {contents.map((content, index) => (
        <div
          key={index}
          className={classNames('max-w-full', { block: index === activeTab, hidden: index !== activeTab })}
        >
          {content}
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
