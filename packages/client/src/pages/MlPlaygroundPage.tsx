import React, { useMemo } from 'react';

import Banner from 'components/Banner';
import { Flexbox } from 'components/base/Layout';
import { TabContent, Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import CubeTray from 'components/cubetray/CubeTray';
import DynamicFlash from 'components/DynamicFlash';
import ArchetypeTab from 'components/mlPlayground/ArchetypeTab';
import DeckbuildTab from 'components/mlPlayground/DeckbuildTab';
import DraftPickTab from 'components/mlPlayground/DraftPickTab';
import GrowTab from 'components/mlPlayground/GrowTab';
import { ResultsViewContext, ResultsViewMode } from 'components/mlPlayground/ResultsView';
import SmartSearchTab from 'components/mlPlayground/SmartSearchTab';
import RenderToRoot from 'components/RenderToRoot';
import { CubeTrayProvider } from 'contexts/CubeTrayContext';
import useLocalStorage from 'hooks/useLocalStorage';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

const TABS = [
  { key: 'search', label: 'Smart Search', content: <SmartSearchTab key="search" /> },
  { key: 'draft', label: 'Draft Pick', content: <DraftPickTab key="draft" /> },
  { key: 'deckbuild', label: 'Deckbuild', content: <DeckbuildTab key="deckbuild" /> },
  { key: 'archetype', label: 'Archetype', content: <ArchetypeTab key="archetype" /> },
  { key: 'grow', label: 'Grow', content: <GrowTab key="grow" /> },
];

const MlPlaygroundPage: React.FC = () => {
  const [tab, setTab] = useQueryParam('tab', TABS[0]!.key);
  const [view, setView] = useLocalStorage<ResultsViewMode>('mlPlayground.view', 'grid');
  const activeTab = Math.max(
    0,
    TABS.findIndex((entry) => entry.key === tab),
  );
  const viewContext = useMemo(() => ({ view, setView }), [view, setView]);

  return (
    <MainLayout>
      <ResultsViewContext.Provider value={viewContext}>
        <CubeTrayProvider>
          <Flexbox direction="col" gap="2" className="my-3">
            <Banner />
            <DynamicFlash />
            <Text xl semibold>
              ML Playground
            </Text>
            <Tabs
              className="border-b border-border"
              activeTab={activeTab}
              tabs={TABS.map((entry) => ({ label: entry.label, onClick: () => setTab(entry.key) }))}
            />
            <TabContent activeTab={activeTab} contents={TABS.map((entry) => entry.content)} className="mt-1" />
          </Flexbox>
          <CubeTray />
        </CubeTrayProvider>
      </ResultsViewContext.Provider>
    </MainLayout>
  );
};

export default RenderToRoot(MlPlaygroundPage);
