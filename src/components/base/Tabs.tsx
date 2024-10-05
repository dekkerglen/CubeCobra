import React, { useState } from 'react';
import classNames from 'classnames';

interface Tab {
  label: string;
  href: string;
}

interface TabsProps {
  tabs: Tab[];
  initialActiveTab?: number;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({ tabs, initialActiveTab = 0, className = '' }) => {
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  return (
    <div className={className}>
      <div className="flex border-b border-gray-200">
        {tabs.map((tab, index) => (
          <a
            key={index}
            href={tab.href}
            className={classNames('px-4 py-2 text-sm font-medium text-gray-600 focus:outline-none', {
              'border-b-2 border-blue-500 text-blue-600': activeTab === index,
              'hover:text-blue-600': activeTab !== index,
            })}
            onClick={() => setActiveTab(index)}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
