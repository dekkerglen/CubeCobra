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
  // Tabs are addressed by a slug in the URL (not a position) so a later reorder can't
  // silently repoint every server redirect that still hardcodes an index.
  const [activeTabSlug, setActiveTabSlug] = useQueryParam('tab', '');
  const user = useContext(UserContext);

  const tabs = [
    {
      name: 'Decks',
      slug: 'decks',
      component: () => <RecordDecks record={record} draft={draft} players={players} />,
    },
    {
      name: 'Standings',
      slug: 'standings',
      component: () => <RecordStandings record={record} />,
    },
    {
      name: 'Matches',
      slug: 'matches',
      component: () => <RecordMatches record={record} />,
    },
  ];

  // An absent or unrecognised slug — including an old `?tab=<index>` bookmark from before
  // tabs were addressed by name — falls back to the first tab rather than landing on a
  // blank page or, worse, whatever tab used to sit at that index.
  const activeTabIndex = Math.max(
    tabs.findIndex((tab) => tab.slug === activeTabSlug),
    0,
  );

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          {/* Overview is no longer a tab — it lives at the top of the page. */}
          <RecordOverview record={record} />
          <TranscribeAction record={record} />
          <TabbedView
            activeTab={activeTabIndex}
            tabs={tabs.map((tab) => ({
              label: tab.name,
              onClick: () => setActiveTabSlug(tab.slug),
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
