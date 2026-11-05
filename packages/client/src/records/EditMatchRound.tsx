import React, { useId } from 'react';

import { PlusIcon, XIcon } from '@primer/octicons-react';
import { Match, PlayerList, Round } from '@utils/datatypes/Record';

import Input from 'components/base/Input';
import MobileFieldLabel from 'components/base/MobileFieldLabel';
import { Col, Flexbox, Row } from 'components/base/Layout';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Text from 'components/base/Text';

// The shape a match starts in, shared with whatever creates a round so a new one arrives
// with a row in it rather than an empty body and a second click to make.
export const emptyMatch = (): Match => ({
  p1: 'Unknown Opponent',
  p2: 'Unknown Opponent',
  results: [0, 0, 0],
});

/**
 * The grid a match's five fields are cut into, shared with anything laying out a row the
 * same way (the matches console's per-match row) so the headings above a list and the cells
 * below it always line up, in whichever component renders them.
 *
 * Three columns on a phone and nine from md up: a pairing takes a whole line below md and a
 * third of one above it, while the three counts sit side by side at either size. The fields
 * were previously a single flex row with the counts fixed at `w-20 shrink-0`, which held
 * their width by squeezing the two selects — down to 26px on a 390px screen, where a select
 * shows a chevron and no name at all.
 */
export const MATCH_PLAYER_COL = { xs: 3 as const, md: 3 as const };
export const MATCH_RESULT_COL = { xs: 1 as const, md: 1 as const };

export const MatchFieldGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Row xs={3} md={9}>
    {children}
  </Row>
);

// The number and remove controls bracket the grid rather than sitting in it: both are a
// fixed icon's width at every size, so they are gutters, not columns. `items-start` keeps
// them against the top of a stacked block below md, where the fields are four lines tall.
export const MatchRowFrame: React.FC<{ lead: React.ReactNode; trail: React.ReactNode; children: React.ReactNode }> = ({
  lead,
  trail,
  children,
}) => (
  <Flexbox direction="row" gap="2" alignItems="start" className="md:items-center">
    {lead}
    <div className="grow min-w-0">{children}</div>
    {trail}
  </Flexbox>
);

export const MATCH_RESULT_HEADINGS = ['P1 Wins', 'P2 Wins', 'Draws'];

// Said once, above a list of match rows, and only at the size where the fields are actually
// in columns. Each cell's own name — "Alice Wins" — stays as its accessible name and its
// title, because a column heading cannot say whose. Exported so the matches console's row (a
// separate component, not this one) heads its list identically.
export const MatchRowHeadings: React.FC = () => (
  <ResponsiveDiv md>
    <div data-testid="match-column-headings">
      <MatchRowFrame
        lead={<span aria-hidden="true" className="w-6 shrink-0" />}
        trail={<span aria-hidden="true" className="w-6 shrink-0" />}
      >
        <MatchFieldGrid>
          <Col {...MATCH_PLAYER_COL}>
            <Text sm semibold className="text-text-secondary">
              Player 1
            </Text>
          </Col>
          <Col {...MATCH_PLAYER_COL}>
            <Text sm semibold className="text-text-secondary">
              Player 2
            </Text>
          </Col>
          {/* Abbreviated because the column is the width of the count it heads; it reads
              against the "Player 1" and "Player 2" headings immediately to its left, and
              each cell still carries the player's own name as its title. */}
          {MATCH_RESULT_HEADINGS.map((heading) => (
            <Col key={heading} {...MATCH_RESULT_COL}>
              <Text sm semibold className="text-text-secondary">
                {heading}
              </Text>
            </Col>
          ))}
        </MatchFieldGrid>
      </MatchRowFrame>
    </div>
  </ResponsiveDiv>
);

interface EditMatchRoundProps {
  players: PlayerList;
  round: Round;
  setRound: (round: Round) => void;
}

// NOTE: RecordMatchRow (the matches console's per-match row) deliberately duplicates this
// component's per-row markup rather than sharing it (see that file for why). Changing this
// row's layout likely means changing that one too.
const EditMatchRound: React.FC<EditMatchRoundProps> = ({ round, players, setRound }) => {
  // Namespaces the control ids so the labels stay bound to their own inputs when more than one
  // round is on the page at once, rather than all pointing at the first round's `match-0-p1`.
  const idPrefix = useId();

  const playerOptions = [
    { label: 'Unknown Opponent', value: 'Unknown Opponent' },
    ...(players?.map((player) => ({
      label: player.name,
      value: player.name,
    })) || []),
  ];

  const updateMatch = (index: number, changes: Partial<Match>) => {
    const newMatches = [...round.matches];
    newMatches[index] = { ...newMatches[index], ...changes };
    setRound({ ...round, matches: newMatches });
  };

  const updateResult = (index: number, position: 0 | 1 | 2, value: string) => {
    const results: [number, number, number] = [...round.matches[index].results];
    results[position] = Number(value);
    updateMatch(index, { results });
  };

  return (
    <Flexbox direction="col" gap="2">
      {round.matches.length > 0 && <MatchRowHeadings />}
      {round.matches.map((match, index) => (
        <MatchRowFrame
          key={index}
          lead={<Text sm className="w-6 shrink-0 text-text-secondary md:pt-2">{`${index + 1}`}</Text>}
          trail={
            /* Removing one match of a round is routine bookkeeping, not the destructive act a
               filled danger button announces. */
            <button
              type="button"
              aria-label={`Remove match ${index + 1}`}
              className="w-6 shrink-0 text-text-secondary hover:text-red-600 md:pt-2"
              onClick={() => {
                const newMatches = [...round.matches];
                newMatches.splice(index, 1);
                setRound({ ...round, matches: newMatches });
              }}
            >
              <XIcon size={16} />
            </button>
          }
        >
          <MatchFieldGrid>
            <Col {...MATCH_PLAYER_COL}>
              <MobileFieldLabel>Player 1</MobileFieldLabel>
              <Select
                id={`${idPrefix}-match-${index}-p1`}
                aria-label="Player 1"
                value={match.p1}
                setValue={(value) => updateMatch(index, { p1: value })}
                options={playerOptions}
              />
            </Col>
            <Col {...MATCH_PLAYER_COL}>
              <MobileFieldLabel>Player 2</MobileFieldLabel>
              <Select
                id={`${idPrefix}-match-${index}-p2`}
                aria-label="Player 2"
                value={match.p2}
                setValue={(value) => updateMatch(index, { p2: value })}
                options={playerOptions}
              />
            </Col>
            {[
              { position: 0 as const, name: `${match.p1} Wins` },
              { position: 1 as const, name: `${match.p2} Wins` },
              { position: 2 as const, name: 'Draws' },
            ].map(({ position, name }) => (
              <Col key={position} {...MATCH_RESULT_COL}>
                <MobileFieldLabel>{MATCH_RESULT_HEADINGS[position]}</MobileFieldLabel>
                <Input
                  id={`${idPrefix}-match-${index}-${position}`}
                  type="number"
                  value={`${match.results[position]}`}
                  onChange={(e) => updateResult(index, position, e.target.value)}
                  otherInputProps={{ min: 0, max: 100, title: name, 'aria-label': name }}
                />
              </Col>
            ))}
          </MatchFieldGrid>
        </MatchRowFrame>
      ))}
      {/* Adding a row to a round is routine, and a filled primary button gave it the same
          weight as Save at the bottom of the page. */}
      <Flexbox direction="row" justify="start">
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium text-link hover:text-link-active"
          onClick={() => setRound({ ...round, matches: [...round.matches, emptyMatch()] })}
        >
          <PlusIcon size={16} />
          Add Match
        </button>
      </Flexbox>
    </Flexbox>
  );
};

export default EditMatchRound;
