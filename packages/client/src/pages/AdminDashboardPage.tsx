import React, { lazy, Suspense } from 'react';

import { AdminTabSpinner } from 'components/admin/AdminTabData';
import { Flexbox } from 'components/base/Layout';
import { TabContent, Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

// Each tab is its own chunk, fetched (along with its data) the first time the tab is opened. The keys
// are the old page names, which the server's /admin/<key> routes and form actions redirect to.
const TABS = [
  { key: 'notices', label: 'Notices', Content: lazy(() => import('components/admin/NoticesTab')) },
  { key: 'reviewcontent', label: 'Review Content', Content: lazy(() => import('components/admin/ReviewContentTab')) },
  { key: 'featuredcubes', label: 'Featured Cubes', Content: lazy(() => import('components/admin/FeaturedCubesTab')) },
  { key: 'cardupdates', label: 'Card Updates', Content: lazy(() => import('components/admin/CardUpdatesTab')) },
  { key: 'mlretraining', label: 'ML Retraining', Content: lazy(() => import('components/admin/MlRetrainingTab')) },
  { key: 'archetypes', label: 'Archetypes', Content: lazy(() => import('components/admin/ArchetypesTab')) },
  { key: 'patrons', label: 'Patrons', Content: lazy(() => import('components/admin/PatronsTab')) },
  { key: 'errors', label: 'Errors', Content: lazy(() => import('components/admin/ErrorsTab')) },
  { key: 'clienterrors', label: 'Client Errors', Content: lazy(() => import('components/admin/ClientErrorsTab')) },
  { key: 'performance', label: 'Performance', Content: lazy(() => import('components/admin/PerformanceTab')) },
  { key: 'pathanalysis', label: 'Path Analysis', Content: lazy(() => import('components/admin/PathAnalysisTab')) },
  { key: 'deckbuild', label: 'Bot Deckbuild', Content: lazy(() => import('components/admin/DeckbuildTab')) },
  { key: 'dailygames', label: 'Daily Games', Content: lazy(() => import('components/admin/DailyGamesTab')) },
  { key: 'siteactivity', label: 'Site Activity', Content: lazy(() => import('components/admin/SiteActivityTab')) },
];

interface AdminDashboardPageProps {
  noticeCount: number;
  contentInReview: number;
}

const withCount = (label: string, count?: number): string => (count ? `${label} (${count})` : label);

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ noticeCount, contentInReview }) => {
  const [tab, setTab] = useQueryParam('tab', TABS[0].key);
  const activeTab = Math.max(
    0,
    TABS.findIndex(({ key }) => key === tab),
  );

  const counts: Record<string, number> = {
    notices: noticeCount,
    reviewcontent: contentInReview,
  };

  return (
    <MainLayout>
      <Flexbox direction="col" gap="2" className="my-3">
        <DynamicFlash />
        <Text xl semibold>
          Admin Dashboard
        </Text>
        <Tabs
          className="border-b border-border"
          tabs={TABS.map(({ key, label }) => ({ label: withCount(label, counts[key]), onClick: () => setTab(key) }))}
          activeTab={activeTab}
        />
        <TabContent
          activeTab={activeTab}
          className="mt-1"
          contents={TABS.map(({ key, Content }) => (
            <ErrorBoundary key={key}>
              <Suspense fallback={<AdminTabSpinner />}>
                <Content />
              </Suspense>
            </ErrorBoundary>
          ))}
        />
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(AdminDashboardPage);
