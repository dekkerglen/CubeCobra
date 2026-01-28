import React, { useContext } from 'react';

import Cube, { CubeCards } from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';
import { RecordAnalytic } from '@utils/datatypes/RecordAnalytic';

import { Card } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { TabbedView } from 'components/base/Tabs';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
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
  records: Record[];
  analyticsData?: RecordAnalytic;
  lastKey: any;
}

const CubeRecordsPage: React.FC<CubeRecordsPageProps> = ({ cube, cards, records, analyticsData, lastKey }) => {
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

  const controls = user && cube.owner.id === user.id ? (
    <Flexbox direction="col" gap="2" className="px-2">
      <Link href={`/cube/records/create/${cube.id}`}>Create new Record</Link>
      <Link href={`/cube/records/create/fromDraft/${cube.id}`}>Create Record from existing Draft</Link>
    </Flexbox>
  ) : undefined;

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} cards={cards} activeLink="records" controls={controls}>
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
