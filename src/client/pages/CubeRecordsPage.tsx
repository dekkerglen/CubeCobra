import React, { useContext } from 'react';

import { Card } from 'components/base/Card';
import Controls from 'components/base/Controls';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { TabbedView } from 'components/base/Tabs';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import Record from 'datatypes/Record';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import DraftReports from '../records/DraftReports';
import TrophyArchive from '../records/TrophyArchive';
import WinrateAnalytics from '../records/WinrateAnalytics';

interface CubeRecordsPageProps {
  cube: Cube;
  decks: Draft[];
  decksLastKey: any;
  loginCallback?: string;
  records: Record[];
  lastKey: any;
}

const CubeRecordsPage: React.FC<CubeRecordsPageProps> = ({ cube, records, lastKey, loginCallback = '/' }) => {
  const user = useContext(UserContext);
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');

  const tabs = [
    {
      name: 'Draft Reports',
      component: () => <DraftReports records={records} lastKey={lastKey} />,
    },
    {
      name: 'Trophy Archive',
      component: () => <TrophyArchive />,
    },
    {
      name: 'Winrate Analytics',
      component: () => <WinrateAnalytics />,
    },
  ];

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="records" hasControls={!!user && cube.owner.id === user.id}>
        {user && cube.owner.id === user.id && (
          <Controls>
            <Flexbox direction="row" justify="start" gap="4" alignItems="center" className="py-2 px-4">
              <Link href={`/cube/records/create/new/${cube.id}`}>Start New Draft</Link>
              <Link href={`/cube/records/create/historical/${cube.id}`}>Upload Historical Report</Link>
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
