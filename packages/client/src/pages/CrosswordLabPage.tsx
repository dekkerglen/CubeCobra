import React, { useCallback, useContext, useMemo, useState } from 'react';

import {
  ALL_CROSSWORD_CLASSES,
  CrosswordEntryClass,
  CrosswordPuzzleGrid,
  CrosswordSymmetry,
} from '@utils/datatypes/Crossword';
import classNames from 'classnames';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import { CrosswordClueBar, CrosswordClueList } from 'components/crossword/CrosswordClues';
import CrosswordGrid from 'components/crossword/CrosswordGrid';
import CrosswordProgressGrid, {
  CrosswordProgressLegend,
  CrosswordProgressSnapshot,
} from 'components/crossword/CrosswordProgressGrid';
import { cellKey, slotCells } from 'components/crossword/crosswordShape';
import { useCrosswordSolver } from 'components/crossword/useCrosswordSolver';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface LengthStat {
  length: number;
  total: number;
  byClass: Record<string, number>;
}

interface CrosswordLabPageProps {
  stats: {
    total: number;
    counts: Record<CrosswordEntryClass, number>;
    lengths: LengthStat[];
  };
}

const CLASS_LABELS: Record<CrosswordEntryClass, string> = {
  cardName: 'Card names',
  nameWord: 'Name words',
  nameBigram: 'Name pairs',
  acronym: 'Acronyms',
  creatureType: 'Creature types',
  keyword: 'Keywords',
  legendName: 'Legend names',
  legendTitle: 'Legend titles',
  setCode: 'Set codes',
  oracleWord: 'Rules words',
};

const CLASS_COLORS: Record<CrosswordEntryClass, string> = {
  cardName: 'bg-blue-500/20 text-blue-200',
  nameWord: 'bg-cyan-500/20 text-cyan-200',
  nameBigram: 'bg-indigo-500/20 text-indigo-200',
  acronym: 'bg-red-500/20 text-red-200',
  creatureType: 'bg-green-500/20 text-green-200',
  keyword: 'bg-yellow-500/20 text-yellow-200',
  legendName: 'bg-purple-500/20 text-purple-200',
  legendTitle: 'bg-teal-500/20 text-teal-200',
  setCode: 'bg-orange-500/20 text-orange-200',
  oracleWord: 'bg-slate-500/20 text-slate-200',
};

/**
 * The lines `/admin/crosswordlab/generate` streams back: any number of
 * `progress`, then exactly one `result` or `error`. See the handler in
 * router/routes/admin/crosswordlab.ts.
 */
type ProgressLine = { type: 'progress' } & CrosswordProgressSnapshot;
interface ResultLine {
  type: 'result';
  success: boolean;
  error?: string;
  grid?: CrosswordPuzzleGrid;
  blocksAdded?: number;
  fillSteps?: number;
  durationMs?: number;
  acronymsUsed?: number;
  themeSize?: number;
}
interface ErrorLine {
  type: 'error';
  error: string;
}
type LabLine = ProgressLine | ResultLine | ErrorLine;

/**
 * The server's ceiling is three minutes and the abort timer has to clear it.
 *
 * In practice it never fires: the handler flushes its headers before it starts
 * generating, so `csrfFetch` resolves — and cancels its timer — within a few
 * milliseconds, and the body then streams for as long as it likes. This is the
 * belt to that braces, and the one thing that would silently cap the new budget
 * at csrfFetch's 60s default if it were left off.
 */
const LAB_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Drains the NDJSON body, reporting every snapshot as it lands and returning the
 * line that ended the stream.
 *
 * Chunk boundaries have nothing to do with line boundaries — one read can carry
 * half a line, or six of them — so the tail of each chunk is carried forward.
 */
const streamGeneration = async (
  body: ReadableStream<Uint8Array>,
  onProgress: (snapshot: CrosswordProgressSnapshot) => void,
): Promise<ResultLine | ErrorLine | null> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let final: ResultLine | ErrorLine | null = null;
  let buffered = '';

  const take = (text: string): void => {
    const line = text.trim();
    if (!line) {
      return;
    }
    const parsed = JSON.parse(line) as LabLine;
    if (parsed.type === 'progress') {
      onProgress(parsed);
    } else {
      final = parsed;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      buffered += decoder.decode(value, { stream: true });
      for (let newline = buffered.indexOf('\n'); newline >= 0; newline = buffered.indexOf('\n')) {
        take(buffered.slice(0, newline));
        buffered = buffered.slice(newline + 1);
      }
    }
    if (done) {
      break;
    }
  }
  // Every line is written with its newline, so this only catches a truncated
  // stream — but a half-written last line would otherwise be swallowed silently.
  take(buffered);
  return final;
};

/**
 * The generator's tuning bench. Solving here shares the daily game's components
 * (components/crossword), but the answers are local: this page is handed the
 * filled grid, so Check, Reveal and the answer key all work without a round trip.
 * That is the difference between a lab and a game — see the note on
 * `generateCrosswordHandler` in router/routes/admin/crosswordlab.ts.
 */
const CrosswordLabPage: React.FC<CrosswordLabPageProps> = ({ stats }) => {
  const { csrfFetch } = useContext(CSRFContext);

  const [size, setSize] = useState('9');
  const [symmetry, setSymmetry] = useState<CrosswordSymmetry>('rotational180');
  const [minWordLength, setMinWordLength] = useState('3');
  const [maxAcronymRatio, setMaxAcronymRatio] = useState('0.1');
  const [themeFilter, setThemeFilter] = useState('ci=g');
  const [seed, setSeed] = useState('');
  const [allowed, setAllowed] = useState<CrosswordEntryClass[]>([...ALL_CROSSWORD_CLASSES]);
  // Acronyms are a fallback by default: there are thousands of them at short
  // lengths and they'd otherwise fill every 3-letter slot.
  const [preferred, setPreferred] = useState<CrosswordEntryClass[]>(
    ALL_CROSSWORD_CLASSES.filter((c) => c !== 'acronym'),
  );

  const [grid, setGrid] = useState<CrosswordPuzzleGrid | null>(null);
  const [meta, setMeta] = useState<{
    blocksAdded: number;
    fillSteps: number;
    durationMs: number;
    acronymsUsed: number;
    themeSize: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** The most recent snapshot the generator streamed; null until the first lands. */
  const [progress, setProgress] = useState<CrosswordProgressSnapshot | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  // The breakdown is the answer key, and it sits right below the grid — so it
  // stays shut until asked for.
  const [showBreakdown, setShowBreakdown] = useState(false);

  const solver = useCrosswordSolver({ shape: grid });

  const toggle = (
    list: CrosswordEntryClass[],
    setList: (v: CrosswordEntryClass[]) => void,
    value: CrosswordEntryClass,
  ) => setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCheckMessage(null);
    setShowBreakdown(false);
    // The live view takes the finished grid's place, so the previous result goes
    // now rather than at the end — otherwise the page shows a solved grid and a
    // half-collapsed one at the same time and it isn't obvious which is which.
    setGrid(null);
    setMeta(null);
    setProgress(null);
    try {
      const response = await csrfFetch('/admin/crosswordlab/generate', {
        method: 'POST',
        timeout: LAB_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: Number(size),
          symmetry,
          minWordLength: Number(minWordLength),
          maxAcronymRatio: Number(maxAcronymRatio),
          themeFilterText: themeFilter,
          allowedClasses: allowed,
          preferredClasses: preferred,
          seed,
        }),
      });

      // Anything that fails before the stream opens — validation, an unparseable
      // theme filter — is still a plain JSON status, so that path is unchanged.
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? 'Generation failed');
        return;
      }

      const data = await streamGeneration(response.body, setProgress);
      if (!data || data.type === 'error' || !data.success) {
        setError(data?.error ?? 'Generation failed');
        return;
      }
      setGrid(data.grid ?? null);
      setMeta({
        blocksAdded: data.blocksAdded ?? 0,
        fillSteps: data.fillSteps ?? 0,
        durationMs: data.durationMs ?? 0,
        acronymsUsed: data.acronymsUsed ?? 0,
        themeSize: data.themeSize ?? 0,
      });
    } catch {
      setError('Generation failed');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [csrfFetch, size, symmetry, minWordLength, maxAcronymRatio, themeFilter, allowed, preferred, seed]);

  /** Every white cell, with the letter that belongs in it. */
  const answerCells = useMemo(() => {
    if (!grid) {
      return [];
    }
    const cells: { row: number; col: number; letter: string }[] = [];
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        if (!grid.blocks[row]![col]) {
          cells.push({ row, col, letter: grid.letters[row]![col]! });
        }
      }
    }
    return cells;
  }, [grid]);

  const check = useCallback(() => {
    if (!grid) {
      return;
    }
    const bad: string[] = [];
    let blank = 0;
    for (const { row, col, letter } of answerCells) {
      const guess = solver.filled[row]?.[col] ?? '';
      if (!guess) {
        blank += 1;
      } else if (guess !== letter) {
        bad.push(cellKey(row, col));
      }
    }
    solver.markWrong(bad);
    setCheckMessage(
      bad.length === 0 && blank === 0
        ? 'Solved.'
        : `${bad.length} wrong letter${bad.length === 1 ? '' : 's'}, ${blank} still blank.`,
    );
  }, [answerCells, grid, solver]);

  const revealWord = useCallback(() => {
    if (!grid || !solver.activeSlot) {
      return;
    }
    solver.writeCells(
      slotCells(solver.activeSlot).map(({ row, col }) => ({ row, col, letter: grid.letters[row]![col]! })),
      true,
    );
    setCheckMessage(null);
  }, [grid, solver]);

  const revealAll = useCallback(() => {
    solver.writeCells(answerCells, true);
    setCheckMessage(null);
  }, [answerCells, solver]);

  const clearAll = useCallback(() => {
    solver.clearAll();
    setCheckMessage(null);
  }, [solver]);

  return (
    <MainLayout>
      <DynamicFlash />
      <Flexbox direction="col" gap="3" className="my-3">
        <Card>
          <CardHeader>
            <Text lg semibold>
              Crossword Lab
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text sm className="text-text-secondary">
                Generates a filled grid from the card vocabulary ({stats.total.toLocaleString()} entries) and clues
                every entry from its class — card names, legend names, titles and acronyms as a plain-English reading of
                a filter that narrows to the card (with the filter itself underneath), name words and name pairs
                fill-in-the-blank, rules words by their position on real cards. No clue contains its own answer or a
                match count. Clues are written per puzzle from the seed and never stored.
              </Text>

              <Flexbox direction="row" gap="3" wrap="wrap" alignItems="end">
                <div className="w-24">
                  <Text xs className="text-text-secondary">
                    Size
                  </Text>
                  <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} />
                </div>
                <div className="w-48">
                  <Text xs className="text-text-secondary">
                    Symmetry
                  </Text>
                  <Select
                    value={symmetry}
                    setValue={(value) => setSymmetry(value as CrosswordSymmetry)}
                    options={[
                      { value: 'rotational180', label: '180° (standard)' },
                      { value: 'rotational90', label: '90° (square only)' },
                      { value: 'none', label: 'None' },
                    ]}
                  />
                </div>
                <div className="w-28">
                  <Text xs className="text-text-secondary">
                    Min word len
                  </Text>
                  <Input type="number" value={minWordLength} onChange={(e) => setMinWordLength(e.target.value)} />
                </div>
                <div className="w-32">
                  <Text xs className="text-text-secondary">
                    Max acronyms
                  </Text>
                  <Input
                    type="number"
                    step="0.05"
                    value={maxAcronymRatio}
                    onChange={(e) => setMaxAcronymRatio(e.target.value)}
                  />
                </div>
                <div className="w-44">
                  <Text xs className="text-text-secondary">
                    Theme filter (full-length slots)
                  </Text>
                  <Input value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)} />
                </div>
                <div className="w-40">
                  <Text xs className="text-text-secondary">
                    Seed (blank = random)
                  </Text>
                  <Input value={seed} onChange={(e) => setSeed(e.target.value)} />
                </div>
                <Button color="primary" onClick={generate} disabled={loading}>
                  {loading ? 'Generating…' : 'Generate'}
                </Button>
              </Flexbox>

              <Flexbox direction="row" gap="4" wrap="wrap">
                <Flexbox direction="col" gap="1">
                  <Text sm semibold>
                    Allowed classes
                  </Text>
                  {ALL_CROSSWORD_CLASSES.map((entryClass) => (
                    <Checkbox
                      key={`allow-${entryClass}`}
                      // Tolerate a class the running server doesn't know about yet: the
                      // client list is compiled in, the counts arrive from a process that
                      // may predate it.
                      label={`${CLASS_LABELS[entryClass]} (${(stats.counts[entryClass] ?? 0).toLocaleString()})`}
                      checked={allowed.includes(entryClass)}
                      setChecked={() => toggle(allowed, setAllowed, entryClass)}
                    />
                  ))}
                </Flexbox>
                <Flexbox direction="col" gap="1">
                  <Text sm semibold>
                    Preferred (tried first)
                  </Text>
                  {ALL_CROSSWORD_CLASSES.map((entryClass) => (
                    <Checkbox
                      key={`prefer-${entryClass}`}
                      label={CLASS_LABELS[entryClass]}
                      checked={preferred.includes(entryClass)}
                      setChecked={() => toggle(preferred, setPreferred, entryClass)}
                    />
                  ))}
                </Flexbox>
              </Flexbox>

              {error && (
                <Text sm className="text-red-500">
                  {error}
                </Text>
              )}
            </Flexbox>
          </CardBody>
        </Card>

        {loading && (
          <Card>
            <CardHeader>
              <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
                <Text lg semibold>
                  Collapsing…
                </Text>
                {progress && (
                  <Text sm className="text-text-secondary">
                    attempt {progress.attempt} · {progress.steps.toLocaleString()} step
                    {progress.steps === 1 ? '' : 's'}
                    {progress.restarts > 0
                      ? ` · ${progress.restarts} restart${progress.restarts === 1 ? '' : 's'}`
                      : ''}{' '}
                    · {(progress.elapsedMs / 1000).toFixed(1)}s
                  </Text>
                )}
              </Flexbox>
            </CardHeader>
            <CardBody>
              <Flexbox direction="col" gap="2">
                <Text sm className="text-text-secondary">
                  Each undecided white cell is coloured by how many letters it still allows — dark blue is wide open,
                  bright red is down to one. The grid resets whenever the attempt number moves: a fresh draw of theme
                  entries is a different grid, and re-seeding is what the budget is mostly spent on.
                </Text>
                {progress ? (
                  <div className="flex w-full max-w-[34rem] flex-col gap-2">
                    <CrosswordProgressGrid progress={progress} maxWidth="34rem" />
                    <CrosswordProgressLegend />
                  </div>
                ) : (
                  <Text sm className="text-text-secondary">
                    Waiting for the first snapshot…
                  </Text>
                )}
              </Flexbox>
            </CardBody>
          </Card>
        )}

        {grid && (
          <Card>
            <CardHeader>
              <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
                <Text lg semibold>
                  {grid.width}×{grid.height} — {grid.slots.length} entries
                </Text>
                {meta && (
                  <Text sm className="text-text-secondary">
                    {grid.blockCount} black square(s) · {meta.fillSteps.toLocaleString()} steps · {meta.durationMs}ms
                    {meta.acronymsUsed > 0
                      ? ` · ${meta.acronymsUsed} acronym(s) (${Math.round((meta.acronymsUsed / grid.slots.length) * 100)}%)`
                      : ''}
                    {meta.themeSize > 0 ? ` · ${meta.themeSize.toLocaleString()} on-theme cards` : ''}
                  </Text>
                )}
              </Flexbox>
            </CardHeader>
            <CardBody>
              <Flexbox direction="col" gap="3">
                {/* lg and up puts the clue lists beside the grid; below that they
                    stack, so the grid never has to shrink to share a row. */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  {/* Sized here rather than on the children so the grid, the clue bar
                      above it and the buttons below it all share one width. */}
                  <div className="flex w-full max-w-[34rem] flex-col gap-2 lg:w-[34rem] lg:max-w-none lg:shrink-0">
                    <CrosswordClueBar activeSlot={solver.activeSlot} />

                    <CrosswordGrid shape={grid} solver={solver} maxWidth="34rem" />

                    <Flexbox direction="row" gap="2" wrap="wrap">
                      <Button color="primary" onClick={check}>
                        Check
                      </Button>
                      <Button color="secondary" onClick={revealWord} disabled={!solver.activeSlot}>
                        Reveal word
                      </Button>
                      <Button color="secondary" outline onClick={revealAll}>
                        Reveal all
                      </Button>
                      <Button color="danger" outline onClick={clearAll}>
                        Clear
                      </Button>
                      {checkMessage && (
                        <Text sm className="self-center text-text-secondary">
                          {checkMessage}
                        </Text>
                      )}
                    </Flexbox>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
                    <CrosswordClueList
                      slots={solver.acrossSlots}
                      heading="Across"
                      activeSlotId={solver.activeSlot?.id}
                      onSelect={solver.selectSlot}
                      showFilter
                    />
                    <CrosswordClueList
                      slots={solver.downSlots}
                      heading="Down"
                      activeSlotId={solver.activeSlot?.id}
                      onSelect={solver.selectSlot}
                      showFilter
                    />
                  </div>
                </div>

                <div>
                  <Button color="secondary" outline onClick={() => setShowBreakdown((open) => !open)}>
                    {showBreakdown ? 'Hide answer key' : 'Show answer key (spoilers)'}
                  </Button>
                </div>

                {/* The generator-tuning view: every slot with its answer, class and
                    clue. Hidden by default so it can't spoil the grid above it. */}
                {showBreakdown && (
                  <Flexbox direction="col" gap="1">
                    {grid.slots.map((slot) => (
                      <Flexbox key={slot.id} direction="row" gap="2" alignItems="center" wrap="wrap">
                        <Text sm className="w-14 shrink-0 text-text-secondary">
                          {slot.number}
                          {slot.direction === 'across' ? 'A' : 'D'}
                        </Text>
                        <Text sm semibold>
                          {slot.entry.text}
                        </Text>
                        <span
                          className={classNames(
                            'rounded px-1.5 py-0.5 text-[10px]',
                            slot.nonsense ? 'bg-red-500/30 text-red-200' : CLASS_COLORS[slot.entry.entryClass],
                          )}
                        >
                          {slot.nonsense ? 'nonsense' : CLASS_LABELS[slot.entry.entryClass]}
                        </span>
                        {slot.length === Number(size) && slot.entry.entryClass === 'cardName' && (
                          <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-200">
                            theme
                          </span>
                        )}
                        {slot.clue && (
                          <Text xs className="text-text-secondary">
                            {slot.clue}
                          </Text>
                        )}
                        {slot.clueFilter && (
                          <Text xs className="font-mono text-text-secondary">
                            {slot.clueFilter}
                          </Text>
                        )}
                        {slot.entry.display !== slot.entry.text && (
                          <Text xs className="text-text-secondary italic">
                            {slot.entry.display}
                          </Text>
                        )}
                      </Flexbox>
                    ))}
                  </Flexbox>
                )}
              </Flexbox>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <Text lg semibold>
              Vocabulary supply by length
            </Text>
          </CardHeader>
          <CardBody>
            <Text sm className="mb-2 text-text-secondary">
              Short slots are the binding constraint. Non-acronym supply is thin at 3–4 letters, so grids with many
              short runs need acronyms enabled — or a higher minimum word length.
            </Text>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="p-1">Len</th>
                    <th className="p-1">Total</th>
                    <th className="p-1">Non-acronym</th>
                    {ALL_CROSSWORD_CLASSES.map((c) => (
                      <th key={c} className="p-1">
                        {CLASS_LABELS[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.lengths.map((row) => {
                    const nonAcronym = row.total - (row.byClass.acronym ?? 0);
                    return (
                      <tr key={row.length} className="border-b border-border">
                        <td className="p-1 font-semibold">{row.length}</td>
                        <td className="p-1">{row.total.toLocaleString()}</td>
                        <td className={classNames('p-1', { 'text-red-400': nonAcronym < 200 })}>
                          {nonAcronym.toLocaleString()}
                        </td>
                        {ALL_CROSSWORD_CLASSES.map((c) => (
                          <td key={c} className="p-1 text-text-secondary">
                            {(row.byClass[c] ?? 0).toLocaleString()}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(CrosswordLabPage);
