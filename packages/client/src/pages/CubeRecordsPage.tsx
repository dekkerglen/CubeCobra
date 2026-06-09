import React, { useContext } from 'react';

import Cube, { CubeCards } from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import { Card } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import DynamicFlash from 'components/DynamicFlash';
import RecordsNavbar from 'components/records/RecordsNavbar';
import RenderToRoot from 'components/RenderToRoot';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import RecordsViewContext, { RecordsViewContextProvider } from 'contexts/RecordsViewContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import DraftReports from '../records/DraftReports';
import WinrateAnalytics from '../records/WinrateAnalytics';

interface CubeRecordsPageProps {
  cube: Cube;
  cards: CubeCards;
  decks: Draft[];
  decksLastKey: any;
  records: Record[];
  lastKey: any;
}

const CubeRecordsPage: React.FC<CubeRecordsPageProps> = ({ cube, cards, records, lastKey }) => {
  const recordsViewContext = useContext(RecordsViewContext);
  const view = recordsViewContext?.view || 'draft-reports';

  let content;
  switch (view) {
    case 'winrate-analytics':
      // The dashboard runs its own client-side analyses (stored locally) and
      // renders its own grid of panels — no outer Card frame, no server data.
      content = <WinrateAnalytics records={records} lastKey={lastKey} />;
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
          <CubeRecordsPageBody content={content} />
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

const CubeRecordsPageBody: React.FC<{ content: React.ReactNode }> = ({ content }) => {
  const { cardsLoading } = useContext(CubeContext);
  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <DynamicFlash />
      <RecordsNavbar />
      {cardsLoading && (
        <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="py-2">
          <Spinner sm />
        </Flexbox>
      )}
      {content}
    </Flexbox>
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
  lastKey,
  decks,
  decksLastKey,
}) => {
  return (
    <CubeRecordsPage
      cube={cube}
      cards={cards}
      records={records}
      lastKey={lastKey}
      decks={decks}
      decksLastKey={decksLastKey}
    />
  );
};

export default RenderToRoot(CubeRecordsPageWrapper);
