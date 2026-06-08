import React, { useContext, useMemo } from 'react';

import Record, { playerRecord } from '@utils/datatypes/Record';

import { CardBody } from 'components/base/Card';
import Link from 'components/base/Link';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import AssignTrophiesModal from 'components/modals/AssignTrophiesModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const AssignTrophiesLink = withModal(Link, AssignTrophiesModal);

interface RecordStandingsProps {
  record: Record;
}

const RecordStandings: React.FC<RecordStandingsProps> = ({ record }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  const standings = useMemo(() => {
    // playerRecord respects a manual override when present, else derives from matches.
    return record.players
      .map((player) => ({
        name: player.name,
        id: player.userId,
        trophy: record.trophy.includes(player.name),
        ...playerRecord(record, player.name),
      }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }, [record]);

  return (
    <>
      <CardBody>
        {isOwner && (
          <AssignTrophiesLink
            modalprops={{
              record,
            }}
          >
            <Text sm className="text-muted">
              {'Assign Trophies'}
            </Text>
          </AssignTrophiesLink>
        )}
      </CardBody>
      <Table
        headers={['Name', 'Wins', 'Losses', 'Draws']}
        rows={standings.map((standing) => ({
          Name: standing.id ? (
            <Link key={standing.id} href={`/user/view/${standing.id}`}>
              <Text sm>{`${standing.trophy ? '🏆' : ''}${standing.name}`}</Text>
            </Link>
          ) : (
            <Text key={standing.name} sm>
              <Text sm>{`${standing.trophy ? '🏆' : ''}${standing.name}`}</Text>
            </Text>
          ),
          Wins: standing.wins,
          Losses: standing.losses,
          Draws: standing.draws,
        }))}
      />
    </>
  );
};

export default RecordStandings;
