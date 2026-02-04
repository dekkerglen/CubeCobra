import React, { useContext } from 'react';

import Cube, { CubeCards } from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';
import { RecordAnalytic } from '@utils/datatypes/RecordAnalytic';

import { Card } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import DynamicFlash from 'components/DynamicFlash';
import RecordsNavbar from 'components/records/RecordsNavbar';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import RecordsViewContext, { RecordsViewContextProvider } from 'contexts/RecordsViewContext';
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
  const recordsViewContext = useContext(RecordsViewContext);
  const view = recordsViewContext?.view || 'draft-reports';

  let content;
  switch (view) {
    case 'trophy-archive':
      content = (
        <Card>
          <TrophyArchive records={records} lastKey={lastKey} />
        </Card>
      );
      break;
    case 'winrate-analytics':
      content = (
        <Card>
          <WinrateAnalytics analyticsData={analyticsData} />
        </Card>
      );
      break;
    case 'draft-reports':
    default:
      content = (
        <Card>
          <DraftReports records={records} lastKey={lastKey} />
        </Card>
      );
      break;
  }

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} cards={cards} activeLink={view}>
          <Flexbox direction="col" gap="2" className="mb-2">
            <DynamicFlash />
            <RecordsNavbar />
            {content}
          </Flexbox>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

const CubeRecordsPageWrapper: React.FC<CubeRecordsPageProps> = (props) => {
  return (
    <RecordsViewContextProvider>
      <CubeRecordsPageInner {...props} />
    </RecordsViewContextProvider>
  );
};

const CubeRecordsPageInner: React.FC<CubeRecordsPageProps> = ({
  cube,
  cards,
  records,
  analyticsData,
  lastKey,
  decks,
  decksLastKey,
}) => {
  return (
    <CubeRecordsPage
      cube={cube}
      cards={cards}
      records={records}
      analyticsData={analyticsData}
      lastKey={lastKey}
      decks={decks}
      decksLastKey={decksLastKey}
    />
  );
};

export default RenderToRoot(CubeRecordsPageWrapper);
