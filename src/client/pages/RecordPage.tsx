import React, { useContext } from 'react';

import { Card, CardHeader } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { TabbedView } from 'components/base/Tabs';
import Text from 'components/base/Text';
import CommentsSection from 'components/comments/CommentsSection';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import Record from 'datatypes/Record';
import User from 'datatypes/User';
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

const RecordPage: React.FC<RecordPageProps> = ({ cube, record, draft, players }) => {
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');
  const user = useContext(UserContext);

  const tabs = [
    {
      name: 'Overview',
      component: () => <RecordOverview record={record} players={players} />,
    },
    {
      name: 'Decks',
      component: () => <RecordDecks record={record} draft={draft} />,
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
    <MainLayout>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Text lg semibold>
              {`${record.name} - `}
              <FormatttedDate date={record.date} />
            </Text>
          </CardHeader>
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
              <CommentsSection parentType="record" parent={record.id} collapse={false} />
            </div>
          )}
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(RecordPage);
