import React, { useContext } from 'react';

import { Card } from 'components/base/Card';
import Controls from 'components/base/Controls';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { TabbedView } from 'components/base/Tabs';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import Cube, { CubeCards } from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import Record from 'datatypes/Record';
import { RecordAnalytic } from 'datatypes/RecordAnalytic';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import DraftReports from '../records/DraftReports';
import TrophyArchive from '../records/TrophyArchive';
import WinrateAnalytics from '../records/WinrateAnalytics';

interface CubeRecordsPageProps {
  cube: Cube;
  cards: CubeCards;
  decks: Draft[];
  decksLastKey: any;
  loginCallback?: string;
  records: Record[];
  analyticsData?: RecordAnalytic;
  lastKey: any;
}

const CubeRecordsPage: React.FC<CubeRecordsPageProps> = ({
  cube,
  cards,
  records,
  analyticsData,
  lastKey,
  loginCallback = '/',
}) => {
  const user = useContext(UserContext);
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');

  const tabs = [
    {
      name: 'Draft Reports',
      component: () => <DraftReports records={records} lastKey={lastKey} />,
    },
    {
      name: 'Trophy Archive',
      component: () => <TrophyArchive records={records} lastKey={lastKey} />,
    },
    {
      name: 'Winrate Analytics',
      component: () => <WinrateAnalytics analyticsData={analyticsData} />,
    },
  ];

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} cards={cards} activeLink="records" hasControls={!!user && cube.owner.id === user.id}>
        {user && cube.owner.id === user.id && (
          <Controls>
            <Flexbox direction="row" justify="start" gap="4" alignItems="center" className="py-2 px-4">
              <Link href={`/cube/records/create/${cube.id}`}>Create new Record</Link>
              <Link href={`/cube/records/create/fromDraft/${cube.id}`}>Create Record from existing Draft</Link>
            </Flexbox>
          </Controls>
        )}
        <DynamicFlash />
        <Card className="my-2">
          <TabbedView
            activeTab={parseInt(activeTab || '0', 10)}
            tabs={tabs.map((tab, index) => ({
              label: tab.name,
              onClick: () => setActiveTab(`${index}`),
              content: tab.component(),
            }))}
          />
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeRecordsPage);
