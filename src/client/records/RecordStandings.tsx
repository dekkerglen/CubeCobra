import React, { useContext, useMemo } from 'react';

import { CardBody } from 'components/base/Card';
import Link from 'components/base/Link';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import AssignTrophiesModal from 'components/modals/AssignTrophiesModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import Record from 'datatypes/Record';

const AssignTrophiesLink = withModal(Link, AssignTrophiesModal);

interface RecordStandingsProps {
  record: Record;
}

const RecordStandings: React.FC<RecordStandingsProps> = ({ record }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  const standings = useMemo(() => {
    const byPlayer = Object.fromEntries(
      record.players.map((player) => [
        player.name,
        {
          name: player.name,
          id: player.userId,
          wins: 0,
          losses: 0,
          draws: 0,
          trophy: record.trophy.includes(player.name),
        },
      ]),
    );

    for (const round of record.matches) {
      for (const match of round.matches) {
        const p1 = byPlayer[match.p1];
        const p2 = byPlayer[match.p2];

        if (match.results[0] > match.results[1]) {
          if (p1) {
            p1.wins += 1;
          }
          if (p2) {
            p2.losses += 1;
          }
        } else if (match.results[0] < match.results[1]) {
          if (p1) {
            p1.losses += 1;
          }
          if (p2) {
            p2.wins += 1;
          }
        } else {
          // Draw
          if (p1) {
            p1.wins += 0.5;
            p1.losses += 0.5;
          }
        }
      }
    }

    return Object.values(byPlayer).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }, [record.matches, record.players, record.trophy]);

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
