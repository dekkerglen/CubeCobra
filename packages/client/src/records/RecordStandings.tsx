import React, { useContext, useMemo, useState } from 'react';

import Record, { isLiveEvent } from '@utils/datatypes/Record';
import { computeStandings, formatPercentage } from '@utils/records/standings';

import { CardBody } from 'components/base/Card';
import Link from 'components/base/Link';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import AssignTrophiesModal from 'components/modals/AssignTrophiesModal';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

const AssignTrophiesLink = withModal(Link, AssignTrophiesModal);

const TIEBREAKER_TOOLTIPS = {
  'OMW%': "Opponents' match-win percentage: the average match-win rate of everyone this player has faced.",
  'GW%': 'Game-win percentage: the share of game points this player has won.',
  'OGW%': "Opponents' game-win percentage: the average game-win rate of everyone this player has faced.",
};
const TIEBREAKERS = Object.keys(TIEBREAKER_TOOLTIPS);

interface RecordStandingsProps {
  // The record as the page has it live, so results reported on the Matches tab show here at once.
  record: Record;
  setDropped: (dropped: string[]) => void;
}

const RecordStandings: React.FC<RecordStandingsProps> = ({ record, setDropped }) => {
  const { canEdit } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [pending, setPending] = useState<string | null>(null);

  const isOwner = canEdit;

  const standings = useMemo(() => computeStandings(record), [record]);
  const showTiebreakers = standings.some((standing) => standing.gameWin !== undefined);
  // Dropping only matters while there are rounds left to pair; an old record shows who
  // dropped without offering to change it.
  const offerDrops = canEdit && isLiveEvent(record);
  const showStatus = offerDrops || standings.some((standing) => standing.dropped);

  const toggleDrop = async (player: string, dropped: boolean) => {
    setPending(player);
    try {
      const response = await csrfFetch(`/cube/records/edit/drop/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, dropped }),
      });
      const json = response.ok ? await response.json() : undefined;
      if (json?.success === 'true') {
        setDropped(json.dropped);
      }
    } catch {
      // Nothing changed on the server, so nothing changes here; the button can be pressed again.
    } finally {
      setPending(null);
    }
  };

  const headers = [
    'Rank',
    'Name',
    'Wins',
    'Losses',
    'Draws',
    'Points',
    ...(showTiebreakers ? TIEBREAKERS : []),
    ...(showStatus ? ['Status'] : []),
  ];

  return (
    <>
      <CardBody className="flex flex-wrap items-center justify-between gap-2">
        {record.finishedAt && (
          <Text semibold>{`Final standings · ${new Date(record.finishedAt).toLocaleDateString()}`}</Text>
        )}
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
        headers={headers}
        hideOnMobile={[...TIEBREAKERS, 'Draws']}
        headerTooltips={TIEBREAKER_TOOLTIPS}
        // A dropped player keeps their place and results, but reads as out of the event.
        getRowProps={(rowIndex) => (standings[rowIndex]?.dropped ? { className: 'opacity-50' } : {})}
        rows={standings.map((standing) => {
          const label = `${record.trophy.includes(standing.name) ? '🏆' : ''}${standing.name}`;
          return {
            Rank: standing.rank,
            Name: standing.userId ? (
              <Link key={standing.userId} href={`/user/view/${standing.userId}`}>
                <Text sm>{label}</Text>
              </Link>
            ) : (
              <Text key={standing.name} sm>
                <Text sm>{label}</Text>
              </Text>
            ),
            Wins: standing.wins,
            Losses: standing.losses,
            Draws: standing.draws,
            Points: <span className="font-semibold">{standing.points}</span>,
            'OMW%': formatPercentage(standing.opponentMatchWin),
            'GW%': formatPercentage(standing.gameWin),
            'OGW%': formatPercentage(standing.opponentGameWin),
            Status: (
              <span className="inline-flex items-center gap-2">
                {standing.dropped && (
                  <Text sm className="text-text-secondary">
                    {'Dropped'}
                  </Text>
                )}
                {offerDrops && (
                  <button
                    type="button"
                    className="text-sm text-text-secondary hover:text-link disabled:opacity-50"
                    disabled={pending === standing.name}
                    aria-label={standing.dropped ? `Return ${standing.name} to the event` : `Drop ${standing.name}`}
                    onClick={() => toggleDrop(standing.name, !standing.dropped)}
                  >
                    {standing.dropped ? 'Undo' : 'Drop'}
                  </button>
                )}
              </span>
            ),
          };
        })}
      />
    </>
  );
};

export default RecordStandings;
