import React, { createRef, useCallback, useContext, useEffect, useState } from 'react';

import { ArrowLeftIcon, UploadIcon } from '@primer/octicons-react';
import { cardOracleId, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Record, { Match, Round } from '@utils/datatypes/Record';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
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
import { CSRFContext } from 'contexts/CSRFContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { BuiltPoolDeck, buildDecksFromPools } from 'utils/buildDeckFromPool';
import { getCards } from 'utils/cards/getCards';

import SimulationProgressBar, {
  getOverallSimProgress,
  type SimulationPhase,
} from '../components/draftSimulator/SimulationProgressBar';
import EditDescription from '../records/EditDescription';
import UploadDeckFromPhoto, { DeckPhoto } from '../records/UploadDeckFromPhoto';

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

interface HedronPlayer {
  id: string; // anonymized "Player N"
  images?: { type: 'pool' | 'deck'; url: string }[]; // deck photos preferred, pool as fallback
}

interface HedronExport {
  eventName: string;
  flightName: string;
  date: string | number;
  tableNumber?: number;
  totalRounds: number;
  playerCount: number;
  players: HedronPlayer[];
  summary?: {
    totalMatches: number;
    totalByes: number;
    totalDraws: number;
  };
  matches: HedronMatch[];
}

// Per-player candidate photos (deck + pool), keyed by player id.
export type PhotosByPlayer = { [playerName: string]: DeckPhoto[] };

interface ImportHedronRecordPageProps {
  cube: Cube;
}

const parseHedronExport = (
  jsonStr: string,
): { record: Partial<Record>; photos: PhotosByPlayer; error?: string } => {
  try {
    const data: HedronExport = JSON.parse(jsonStr);

    if (!data.players || !Array.isArray(data.players)) {
      return { record: {}, photos: {}, error: 'Invalid format: missing players array' };
    }
    if (!data.matches || !Array.isArray(data.matches)) {
      return { record: {}, photos: {}, error: 'Invalid format: missing matches array' };
    }

    const name = [data.eventName, data.flightName].filter(Boolean).join(' - ');
    const date = data.date ? new Date(data.date).valueOf() : new Date().valueOf();
    const players = data.players.map((p) => ({ name: p.id }));

    // Candidate photos per player (each tagged pool/deck).
    const photos: PhotosByPlayer = Object.fromEntries(
      data.players.map((p) => [p.id, (p.images ?? []).map((img) => ({ type: img.type, url: img.url }))]),
    );

    // Group matches by round.
    const roundMap = new Map<number, Match[]>();
    for (const m of data.matches) {
      if (!roundMap.has(m.round)) {
        roundMap.set(m.round, []);
      }
      roundMap.get(m.round)!.push({
        p1: m.player1,
        p2: m.player2,
        results: [m.result.player1Wins, m.result.player2Wins, m.result.draws],
      });
    }
    const matches: Round[] = Array.from(roundMap.keys())
      .sort((a, b) => a - b)
      .map((roundNum) => ({ matches: roundMap.get(roundNum)! }));

    // Standings → trophy winner (Wins=3, Draws=1; tiebreak MWP then OMWP).
    const playerStats = new Map<string, { wins: number; losses: number; draws: number; opponents: string[] }>();
    for (const p of data.players) {
      playerStats.set(p.id, { wins: 0, losses: 0, draws: 0, opponents: [] });
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
        if (s1) s1.draws += 1;
        if (s2) s2.draws += 1;
      }
    }
    const mwp = (playerName: string): number => {
      const stats = playerStats.get(playerName);
      if (!stats) return 0.33;
      const total = stats.wins + stats.losses + stats.draws;
      if (total === 0) return 0.33;
      return Math.max((stats.wins * 3 + stats.draws) / (total * 3), 0.33);
    };
    const omwp = (playerName: string): number => {
      const stats = playerStats.get(playerName);
      if (!stats || stats.opponents.length === 0) return 0.33;
      return stats.opponents.reduce((acc, opp) => acc + mwp(opp), 0) / stats.opponents.length;
    };
    const standings = data.players
      .map((p) => {
        const stats = playerStats.get(p.id)!;
        return { name: p.id, points: stats.wins * 3 + stats.draws, mwp: mwp(p.id), omwp: omwp(p.id) };
      })
      .sort((a, b) => b.points - a.points || b.mwp - a.mwp || b.omwp - a.omwp);
    const trophy = standings.length > 0 ? [standings[0].name] : [];

    return { record: { name, date, players, matches, description: '', trophy }, photos };
  } catch {
    return { record: {}, photos: {}, error: 'Invalid JSON. Please paste a valid Hedron Network export.' };
  }
};

const ImportHedronRecordPage: React.FC<ImportHedronRecordPageProps> = ({ cube }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [step, setStep] = useState(0);
  const [jsonInput, setJsonInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [record, setRecord] = useState<Partial<Record>>({});
  const [photos, setPhotos] = useState<PhotosByPlayer>({});
  // Each player's decklist (card names) and whether their (pool) photo should be
  // run through the deckbuilder on submit. Keyed by 1-based player index, reported
  // live by that player's photo scanner.
  const [deckNames, setDeckNames] = useState<{ [playerIndex: number]: string[] }>({});
  const [autoBuildFlags, setAutoBuildFlags] = useState<{ [playerIndex: number]: boolean }>({});
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Submit progress, reusing the draft simulator's exact phase + bar. setup =
  // resolving cards, loadmodel = downloading the draft model (the dominant cost),
  // deckbuild = the batched approximate-deck pass.
  const [simPhase, setSimPhase] = useState<SimulationPhase>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [decksPayload, setDecksPayload] = useState<{
    [playerIndex: number]: { mainboard: string[]; sideboard: string[] };
  }>({});
  const [submitReady, setSubmitReady] = useState(false);
  const formRef = createRef<HTMLFormElement>();

  const setPlayerCards = useCallback(
    (playerIndex: number, names: string[], autoBuild: boolean) => {
      setDeckNames((prev) => ({ ...prev, [playerIndex]: names }));
      setAutoBuildFlags((prev) => ({ ...prev, [playerIndex]: autoBuild }));
    },
    [],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonInput(event.target?.result as string);
      setParseError(null);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    const { record: parsed, photos: parsedPhotos, error } = parseHedronExport(jsonInput);
    if (error) {
      setParseError(error);
      return;
    }
    setRecord(parsed);
    setPhotos(parsedPhotos);
    setParseError(null);
    setStep(1);
  };

  // Resolve every player's card names once, batch-approximate decks for any pool
  // the player flagged (one model load + one batched deckbuild for everyone),
  // then submit each seat's built mainboard + sideboard. Heavy ML work happens
  // here, under one progress bar, before the record + decks are submitted.
  const createRecord = async () => {
    setSubmitting(true);
    try {
      const players = Object.entries(deckNames)
        .map(([idx, names]) => ({ idx: Number(idx), names: names.filter((n) => n.trim()) }))
        .filter((player) => player.names.length > 0);

      if (players.length === 0) {
        setDecksPayload({});
        setSubmitReady(true);
        return;
      }

      // 1. Resolve every player's scanned names to cards in ONE batched request
      //    (instead of a getCard call per card). We need oracle ids for the
      //    payload and card details for the deckbuilder's metadata.
      setSimPhase('setup');
      const flatNames = players.flatMap((player) => player.names.map((n) => n.trim()));
      const flatCards = await getCards(csrfFetch, cube.defaultPrinting, flatNames);
      // Slice the flat result back out per player, dropping unresolved names.
      let cursor = 0;
      const resolved = players.map((player) => {
        const cards = flatCards
          .slice(cursor, cursor + player.names.length)
          .filter((card): card is CardDetails => card !== null);
        cursor += player.names.length;
        return { idx: player.idx, cards };
      });

      const oraclesOf = (cards: CardDetails[]): string[] => cards.map((card) => cardOracleId(detailsToCard(card)));

      // 2. Batch-approximate decks for every pool the player asked to auto-build —
      //    a single model load + one batched deckbuild pass for all of them.
      const toBuild = resolved
        .filter((player) => autoBuildFlags[player.idx])
        .map((player) => ({ key: player.idx, oracles: oraclesOf(player.cards) }));
      const allDetails = resolved.flatMap((player) => player.cards);

      let built = new Map<number, BuiltPoolDeck>();
      if (toBuild.length > 0) {
        setSimPhase('loadmodel');
        setModelLoadProgress(0);
        built = await buildDecksFromPools(csrfFetch, cube, toBuild, allDetails, {
          onModelProgress: (pct) => setModelLoadProgress(pct),
          onBuildStart: () => setSimPhase('deckbuild'),
        });
      }

      // 3. Assemble each seat's payload: an auto-built pool contributes its built
      //    mainboard plus the rest as a sideboard; any other list is already a
      //    deck (or a build that fell back to the raw pool).
      const payload: { [playerIndex: number]: { mainboard: string[]; sideboard: string[] } } = {};
      for (const { idx, cards } of resolved) {
        const deck = built.get(idx);
        const mainboard = deck ? deck.mainboard : oraclesOf(cards);
        const sideboard = deck ? deck.sideboard : [];
        if (mainboard.length > 0) {
          payload[idx] = { mainboard, sideboard };
        }
      }

      setSimPhase('save');
      setDecksPayload(payload);
      setSubmitReady(true);
    } catch {
      setSubmitting(false);
      setSimPhase(null);
    }
  };

  useEffect(() => {
    if (submitReady) {
      formRef.current?.submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitReady]);

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

            {step === 1 && (
              <Flexbox direction="col" gap="2">
                <Link onClick={() => setStep(0)}>
                  <ArrowLeftIcon size={16} />
                  Back
                </Link>
                <Text md semibold>
                  2. Review Record Details
                </Text>
                <EditDescription value={record} setValue={setRecord} />

                <Text sm semibold className="mt-2">
                  Decks
                </Text>
                <Text sm className="text-text-secondary">
                  Each player&apos;s photos are below — pick the best photo (deck preferred), rotate it, and scan. Pool
                  photos can be turned into an approximate deck. Everything runs in your browser.
                </Text>
                {record.players?.map((player, idx) => {
                  const playerIndex = idx + 1;
                  const playerPhotos = photos[player.name] ?? [];
                  const count = deckNames[playerIndex]?.length ?? 0;
                  return (
                    <div key={idx} className="border border-border rounded-md p-2">
                      {playerPhotos.length > 0 ? (
                        <UploadDeckFromPhoto
                          cube={cube}
                          setAlerts={setAlerts}
                          photos={playerPhotos}
                          onCardsChange={(names, autoBuild) => setPlayerCards(playerIndex, names, autoBuild)}
                          header={
                            <Text semibold>
                              {player.name} — {count} card{count === 1 ? '' : 's'}
                            </Text>
                          }
                        />
                      ) : (
                        <Text sm>{player.name} — no deck/pool photos submitted</Text>
                      )}
                    </div>
                  );
                })}

                {alerts.map(({ color, message }, index) => (
                  <Alert key={index} color={color}>
                    {message}
                  </Alert>
                ))}

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

                {submitting && simPhase && (
                  <div className="mt-2">
                    <SimulationProgressBar
                      phase={simPhase}
                      overallProgress={getOverallSimProgress(simPhase, modelLoadProgress, 0)}
                      label={simPhase === 'setup' ? 'Resolving cards…' : undefined}
                    />
                  </div>
                )}

                <CSRFForm
                  method="POST"
                  action={`/cube/records/hedron/${cube.id}`}
                  formData={{ record: JSON.stringify(record), decks: JSON.stringify(decksPayload) }}
                  ref={formRef}
                >
                  <LoadingButton onClick={createRecord} color="primary" block disabled={submitting}>
                    {submitting ? 'Building decks…' : 'Create Record'}
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
