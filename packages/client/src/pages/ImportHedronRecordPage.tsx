import React, { createRef, useState } from 'react';

import { ArrowLeftIcon, UploadIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import Record, { Match, Round } from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import EditDescription from '../records/EditDescription';

interface HedronMatch {
  round: number;
  player1: string;
  player2: string;
  result: {
    player1Wins: number;
    player2Wins: number;
    draws: number;
  };
}

interface HedronExport {
  eventName: string;
  flightName: string;
  date: string;
  tableNumber?: number;
  totalRounds: number;
  playerCount: number;
  players: string[];
  summary?: {
    totalMatches: number;
    totalByes: number;
    totalDraws: number;
  };
  matches: HedronMatch[];
}

interface ImportHedronRecordPageProps {
  cube: Cube;
}

const parseHedronExport = (jsonStr: string): { record: Partial<Record>; error?: string } => {
  try {
    const data: HedronExport = JSON.parse(jsonStr);

    if (!data.players || !Array.isArray(data.players)) {
      return { record: {}, error: 'Invalid format: missing players array' };
    }
    if (!data.matches || !Array.isArray(data.matches)) {
      return { record: {}, error: 'Invalid format: missing matches array' };
    }

    // Build name from event + flight
    const name = [data.eventName, data.flightName].filter(Boolean).join(' - ');

    // Parse date
    const date = data.date ? new Date(data.date).valueOf() : new Date().valueOf();

    // Build player list
    const players = data.players.map((playerName) => ({
      name: playerName,
    }));

    // Group matches by round
    const roundMap = new Map<number, Match[]>();
    for (const m of data.matches) {
      const roundNum = m.round;
      if (!roundMap.has(roundNum)) {
        roundMap.set(roundNum, []);
      }
      roundMap.get(roundNum)!.push({
        p1: m.player1,
        p2: m.player2,
        results: [m.result.player1Wins, m.result.player2Wins, m.result.draws],
      });
    }

    // Sort rounds by number and build rounds array
    const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const matches: Round[] = sortedRounds.map((roundNum) => ({
      matches: roundMap.get(roundNum)!,
    }));

    // Calculate standings to determine trophy winner
    // Wins = 3 pts, Draws = 1 pt. Tiebreakers: match win %, then opponent match win %
    const playerStats = new Map<string, { wins: number; losses: number; draws: number; opponents: string[] }>();
    for (const p of data.players) {
      playerStats.set(p, { wins: 0, losses: 0, draws: 0, opponents: [] });
    }

    for (const m of data.matches) {
      const s1 = playerStats.get(m.player1);
      const s2 = playerStats.get(m.player2);
      if (s1) s1.opponents.push(m.player2);
      if (s2) s2.opponents.push(m.player1);

      if (m.result.player1Wins > m.result.player2Wins) {
        if (s1) s1.wins += 1;
        if (s2) s2.losses += 1;
      } else if (m.result.player2Wins > m.result.player1Wins) {
        if (s2) s2.wins += 1;
        if (s1) s1.losses += 1;
      } else {
        // Match draw (equal game wins)
        if (s1) s1.draws += 1;
        if (s2) s2.draws += 1;
      }
    }

    // Match win percentage (with 0.33 floor per MTG tiebreaker rules)
    const mwp = (playerName: string): number => {
      const stats = playerStats.get(playerName);
      if (!stats) return 0.33;
      const totalMatches = stats.wins + stats.losses + stats.draws;
      if (totalMatches === 0) return 0.33;
      const pct = (stats.wins * 3 + stats.draws) / (totalMatches * 3);
      return Math.max(pct, 0.33);
    };

    // Opponent match win percentage
    const omwp = (playerName: string): number => {
      const stats = playerStats.get(playerName);
      if (!stats || stats.opponents.length === 0) return 0.33;
      const sum = stats.opponents.reduce((acc, opp) => acc + mwp(opp), 0);
      return sum / stats.opponents.length;
    };

    // Sort players by points desc, then MWP desc, then OMWP desc
    const standings = data.players
      .map((p) => {
        const stats = playerStats.get(p)!;
        const points = stats.wins * 3 + stats.draws;
        return { name: p, points, mwp: mwp(p), omwp: omwp(p) };
      })
      .sort((a, b) => b.points - a.points || b.mwp - a.mwp || b.omwp - a.omwp);

    const trophy = standings.length > 0 ? [standings[0].name] : [];

    return {
      record: {
        name,
        date,
        players,
        matches,
        description: '',
        trophy,
      },
    };
  } catch {
    return { record: {}, error: 'Invalid JSON. Please paste a valid Hedron Network export.' };
  }
};

const ImportHedronRecordPage: React.FC<ImportHedronRecordPageProps> = ({ cube }) => {
  const [step, setStep] = useState(0);
  const [jsonInput, setJsonInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [record, setRecord] = useState<Partial<Record>>({});
  const formRef = createRef<HTMLFormElement>();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonInput(text);
      setParseError(null);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    const { record: parsed, error } = parseHedronExport(jsonInput);
    if (error) {
      setParseError(error);
      return;
    }
    setRecord(parsed);
    setParseError(null);
    setStep(1);
  };

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Text lg semibold>
              Import from Hedron Network
            </Text>
          </CardHeader>
          <CardBody>
            {/* Step 0: Paste or upload JSON */}
            {step === 0 && (
              <Flexbox direction="col" gap="2">
                <Text md semibold>
                  1. Paste or Upload Hedron Network Export
                </Text>
                <Text sm className="text-text-secondary">
                  Export your draft results from Hedron Network as JSON, then paste the contents below or upload the
                  file.
                </Text>

                <Flexbox direction="row" gap="2" alignItems="center">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded bg-bg-active border border-border hover:bg-bg-active-hover transition-colors text-sm font-medium">
                    <UploadIcon size={16} />
                    Upload JSON File
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                  </label>
                </Flexbox>

                <TextArea
                  value={jsonInput}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setJsonInput(e.target.value);
                    setParseError(null);
                  }}
                  placeholder="Paste Hedron Network JSON export here..."
                  className="font-mono text-sm"
                  rows={12}
                />

                {parseError && (
                  <Text sm className="text-danger">
                    {parseError}
                  </Text>
                )}

                <Button onClick={handleParse} color="primary" disabled={!jsonInput.trim()}>
                  Parse and Continue
                </Button>
              </Flexbox>
            )}

            {/* Step 1: Review and edit name/description */}
            {step === 1 && (
              <Flexbox direction="col" gap="2">
                <Link onClick={() => setStep(0)}>
                  <ArrowLeftIcon size={16} />
                  Back to Step 1
                </Link>
                <Text md semibold>
                  2. Review Record Details
                </Text>
                <EditDescription value={record} setValue={setRecord} />

                <Text sm semibold className="mt-2">
                  Players ({record.players?.length || 0})
                </Text>
                <div className="border border-border rounded p-2">
                  {record.players?.map((player, idx) => (
                    <Text sm key={idx} className="py-0.5">
                      {player.name}
                    </Text>
                  ))}
                </div>

                <Text sm semibold className="mt-2">
                  Rounds ({record.matches?.length || 0})
                </Text>
                {record.matches?.map((round, rIdx) => (
                  <div key={rIdx} className="border border-border rounded p-2 mb-1">
                    <Text sm semibold>
                      Round {rIdx + 1}
                    </Text>
                    {round.matches.map((match, mIdx) => (
                      <Text sm key={mIdx} className="py-0.5 ml-2">
                        {match.p1} vs {match.p2}: {match.results[0]}-{match.results[1]}
                        {match.results[2] > 0 ? `-${match.results[2]}` : ''}
                      </Text>
                    ))}
                  </div>
                ))}

                {record.trophy && record.trophy.length > 0 && (
                  <div className="border border-border rounded p-2 bg-bg-active">
                    <Text sm semibold>
                      🏆 Trophy: {record.trophy.join(', ')}
                    </Text>
                  </div>
                )}

                <CSRFForm
                  method="POST"
                  action={`/cube/records/hedron/${cube.id}`}
                  formData={{ record: JSON.stringify(record) }}
                  ref={formRef}
                >
                  <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
                    Create Record
                  </LoadingButton>
                </CSRFForm>
              </Flexbox>
            )}
          </CardBody>
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(ImportHedronRecordPage);
