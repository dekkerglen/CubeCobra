import React, { lazy, Suspense } from 'react';

import { AdminTabSpinner } from 'components/admin/AdminTabData';
import Alert from 'components/base/Alert';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { TabContent, Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';
import { AdminAlerts } from 'utils/adminAlerts';

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
];

interface AdminDashboardPageProps {
  noticeCount: number;
  contentInReview: number;
  adminAlerts?: AdminAlerts;
}

const withCount = (label: string, count?: number): string => (count ? `${label} (${count})` : label);

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ noticeCount, contentInReview, adminAlerts }) => {
  const [tab, setTab] = useQueryParam('tab', TABS[0].key);
  const activeTab = Math.max(
    0,
    TABS.findIndex(({ key }) => key === tab),
  );

  const alertCount = adminAlerts?.count ?? 0;
  const counts: Record<string, number> = {
    notices: noticeCount,
    reviewcontent: contentInReview,
    mlretraining: alertCount,
  };

  return (
    <MainLayout>
      <Flexbox direction="col" gap="2" className="my-3">
        <DynamicFlash />
        {alertCount > 0 && (
          <Alert color="warning">
            <Link onClick={() => setTab('mlretraining')}>ML Retraining</Link>:{' '}
            {alertCount === 1 ? '1 run needs attention' : `${alertCount} runs need attention`}
          </Alert>
        )}
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
