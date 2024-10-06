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
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab }) => {
  return (
    <Flexbox direction="row">
      {tabs.map((tab, index) => {
        const isActive = activeTab === index;
        const commonClasses = classNames(
          'px-8 py-2 text-md font-medium focus:outline-none transition-colors duration-300',
          {
            'border-b-2 border-button-primary text-text': isActive,
            'border-transparent hover:text-button-primary text-button-primary hover:text-button-primary-active':
              !isActive,
          },
        );

        return tab.href ? (
          <a key={index} href={tab.href} className={commonClasses} onClick={tab.onClick}>
            {tab.label}
          </a>
        ) : (
          <button key={index} className={commonClasses} onClick={tab.onClick}>
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
        <div key={index} className={index === activeTab ? 'block' : 'hidden'}>
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
  className?: string;
}

export const TabbedView: React.FC<TabbedViewProps> = ({ activeTab, tabs, className }) => {
  return (
    <div className={className}>
      <Tabs tabs={tabs} activeTab={activeTab} />
      <TabContent activeTab={activeTab} contents={tabs.map((tab) => tab.content)} />
    </div>
  );
};
