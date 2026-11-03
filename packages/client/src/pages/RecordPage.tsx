import React, { useContext } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import { TabbedView } from 'components/base/Tabs';
import CommentsSection from 'components/comments/CommentsSection';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import RecordDecks from '../records/RecordDecks';
import RecordMatches from '../records/RecordMatches';
import RecordOverview from '../records/RecordOverview';
import RecordStandings from '../records/RecordStandings';

interface RecordPageProps {
  cube: Cube;
  record: Record;
  draft?: Draft;
  players: User[];
}

// The whole event in one editable page, for someone transcribing a draft they already have the
// data for rather than running one live. It sits above the tabs rather than inside one of them:
// whichever tab an owner is on when they decide to enter the rest of the event, it is here.
const TranscribeAction: React.FC<{ record: Record }> = ({ record }) => {
  const { canEdit } = useContext(CubeContext);

  if (!canEdit) {
    return null;
  }

  return (
    <CardBody className="pt-0">
      <Flexbox direction="row" justify="start">
        <Button type="link" color="primary" href={`/cube/records/enter/${record.id}`}>
          Enter event data
        </Button>
      </Flexbox>
    </CardBody>
  );
};

const RecordPage: React.FC<RecordPageProps> = ({ cube, record, draft, players }) => {
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');
  const user = useContext(UserContext);

  const tabs = [
    {
      name: 'Decks',
      component: () => <RecordDecks record={record} draft={draft} players={players} />,
    },
    {
      name: 'Standings',
      component: () => <RecordStandings record={record} />,
    },
    {
      name: 'Matches',
      component: () => <RecordMatches record={record} />,
    },
  ];

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          {/* Overview is no longer a tab — it lives at the top of the page. */}
          <RecordOverview record={record} />
          <TranscribeAction record={record} />
          <TabbedView
            activeTab={parseInt(activeTab || '0', 10)}
            tabs={tabs.map((tab, index) => ({
              label: tab.name,
              onClick: () => setActiveTab(`${index}`),
              content: tab.component(),
            }))}
          />
          {user && (
            <div className="border-t border-border">
              <CommentsSection parentType="record" parent={record.id} />
            </div>
          )}
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(RecordPage);
