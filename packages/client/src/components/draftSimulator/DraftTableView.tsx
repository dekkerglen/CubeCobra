import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CardMeta, SlimPool } from '@utils/datatypes/SimulationReport';

import { MTG_COLORS } from './SimulatorCharts';

// ─── Layout constants ────────────────────────────────────────────────────────

const CW = 880;    // container width
const CH = 660;    // container height (tall enough for top/bottom seats)
const TCX = CW / 2;
const TCY = CH / 2;
const TRX = 190;   // table oval half-width
const TRY = 120;   // table oval half-height
const SRX = 330;   // seat ring half-width
const SRY = 215;   // seat ring half-height
const SEAT_W = 144;
const CARD_W = 70;
const CARD_H = Math.round(CARD_W * (88 / 63)); // ≈ 98px (card aspect ratio)
const THUMB_W = 31;
const THUMB_H = Math.round(THUMB_W * (88 / 63)); // ≈ 43px

const SPEEDS = [
  { label: 'Slow', ms: 2400 },
  { label: 'Medium', ms: 1100 },
  { label: 'Fast', ms: 450 },
];

const PICK_ANIM_CSS = `
@keyframes draftPickIn {
  from { opacity: 0; transform: scale(0.6) translateY(-14px) rotate(-7deg); }
  to   { opacity: 1; transform: scale(1) translateY(0)  rotate(0deg); }
}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSeatPositions(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: TCX + SRX * Math.cos(angle), y: TCY + SRY * Math.sin(angle) };
  });
}

function archetypeColorCodes(archetype: string | undefined): string[] {
  if (!archetype) return ['C'];
  const colors = archetype.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return colors.length > 0 ? colors : ['C'];
}

function seatBorderColor(codes: string[]): string {
  if (codes.length === 1) return MTG_COLORS[codes[0]]?.bg ?? '#666';
  return MTG_COLORS[codes[0]]?.bg ?? '#666';
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step { pack: number; pick: number }

interface SeatState {
  currentPick: string | null;
  prevPicks: string[]; // ordered oldest→newest
  archetype: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DraftTableViewProps {
  slimPools: SlimPool[];
  cardMeta: Record<string, CardMeta>;
  numDrafts: number;
  numSeats: number;
}

const DraftTableView: React.FC<DraftTableViewProps> = ({ slimPools, cardMeta, numDrafts, numSeats }) => {
  const [draftIndex, setDraftIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sorted picks per seat for the selected draft
  const draftSeatPicks = useMemo(() => {
    const map = new Map<number, SlimPool['picks']>();
    for (const pool of slimPools) {
      if (pool.draftIndex !== draftIndex) continue;
      const sorted = [...pool.picks].sort((a, b) =>
        a.packNumber !== b.packNumber ? a.packNumber - b.packNumber : a.pickNumber - b.pickNumber,
      );
      map.set(pool.seatIndex, sorted);
    }
    return map;
  }, [slimPools, draftIndex]);

  // Archetype per seat
  const seatArchetypes = useMemo(() => {
    const map = new Map<number, string>();
    for (const pool of slimPools) {
      if (pool.draftIndex === draftIndex) map.set(pool.seatIndex, pool.archetype ?? '');
    }
    return map;
  }, [slimPools, draftIndex]);

  // All (pack, pick) steps for this draft, sorted
  const steps = useMemo<Step[]>(() => {
    const seen = new Set<string>();
    const arr: Step[] = [];
    for (const picks of draftSeatPicks.values()) {
      for (const p of picks) {
        const key = `${p.packNumber}:${p.pickNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          arr.push({ pack: p.packNumber, pick: p.pickNumber });
        }
      }
    }
    return arr.sort((a, b) => a.pack !== b.pack ? a.pack - b.pack : a.pick - b.pick);
  }, [draftSeatPicks]);

  const maxStep = Math.max(0, steps.length - 1);
  const currentStep = steps[stepIndex] ?? { pack: 1, pick: 1 };
  const packSize = useMemo(
    () => steps.filter((s) => s.pack === 1).length,
    [steps],
  );
  // Pack 1 & 3 pass left; pack 2 passes right (standard booster draft)
  const passesLeft = currentStep.pack % 2 === 1;

  // Per-seat state at the current step
  const seatStates = useMemo<Map<number, SeatState>>(() => {
    const result = new Map<number, SeatState>();
    for (let seat = 0; seat < numSeats; seat++) {
      const picks = draftSeatPicks.get(seat) ?? [];
      let currentPick: string | null = null;
      const prevPicks: string[] = [];
      for (let i = 0; i < picks.length; i++) {
        const p = picks[i]!;
        const pIdx = steps.findIndex((s) => s.pack === p.packNumber && s.pick === p.pickNumber);
        if (pIdx < stepIndex) prevPicks.push(p.oracle_id);
        else if (pIdx === stepIndex) currentPick = p.oracle_id;
      }
      result.set(seat, { currentPick, prevPicks, archetype: seatArchetypes.get(seat) ?? '' });
    }
    return result;
  }, [draftSeatPicks, stepIndex, steps, seatArchetypes, numSeats]);

  const seatPositions = useMemo(() => getSeatPositions(numSeats), [numSeats]);

  // Auto-play
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) return;
    const ms = SPEEDS[speedIndex]?.ms ?? 1100;
    intervalRef.current = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= maxStep) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speedIndex, maxStep]);

  const nudge = useCallback((dir: 1 | -1) => {
    setIsPlaying(false);
    setStepIndex((prev) => Math.max(0, Math.min(maxStep, prev + dir)));
  }, [maxStep]);

  useEffect(() => { setStepIndex(0); setIsPlaying(false); }, [draftIndex]);

  const cardImg = (oracle: string) => cardMeta[oracle]?.imageUrl ?? `/tool/cardimage/${encodeURIComponent(oracle)}`;
  const cardName = (oracle: string) => cardMeta[oracle]?.name ?? oracle;

  const draftOptions = useMemo(
    () => Array.from({ length: numDrafts }, (_, i) => ({ value: String(i), label: `Draft ${i + 1}` })),
    [numDrafts],
  );

  return (
    <div className="flex flex-col gap-3 select-none">
      <style>{PICK_ANIM_CSS}</style>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Draft selector */}
        <select
          value={String(draftIndex)}
          onChange={(e) => setDraftIndex(Number(e.target.value))}
          className="rounded border border-border bg-bg text-sm px-2 py-1 text-text"
        >
          {draftOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Playback */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={stepIndex === 0}
            className="px-2 py-1 text-base rounded border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none"
          >‹</button>
          <button
            type="button"
            onClick={() => {
              if (stepIndex >= maxStep) setStepIndex(0);
              setIsPlaying((p) => !p);
            }}
            className="px-3 py-1 text-sm rounded border border-border bg-bg hover:bg-bg-active text-text min-w-[72px] text-center"
          >
            {isPlaying ? '⏸ Pause' : stepIndex >= maxStep ? '↺ Replay' : '▶ Play'}
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={stepIndex >= maxStep}
            className="px-2 py-1 text-base rounded border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none"
          >›</button>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSpeedIndex(i)}
              className={[
                'px-2 py-0.5 text-xs rounded border',
                speedIndex === i
                  ? 'border-link text-link bg-link/10'
                  : 'border-border text-text-secondary hover:text-text hover:bg-bg-active',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Scrubber */}
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="range"
            min={0}
            max={maxStep}
            value={stepIndex}
            onChange={(e) => { setIsPlaying(false); setStepIndex(Number(e.target.value)); }}
            className="w-44 accent-link"
          />
          <span className="text-xs text-text-secondary whitespace-nowrap tabular-nums">
            P{currentStep.pack}P{currentStep.pick} · {stepIndex + 1}/{steps.length}
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
        <div style={{ position: 'relative', width: CW, height: CH, overflow: 'visible' }}>

          {/* Felt oval */}
          <div style={{
            position: 'absolute',
            left: TCX - TRX,
            top: TCY - TRY,
            width: TRX * 2,
            height: TRY * 2,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 38% 32%, #2e9142 0%, #1d6a2e 50%, #124820 100%)',
            border: '6px solid #7a6040',
            boxShadow: '0 0 0 2px #5a4428, 0 12px 40px rgba(0,0,0,0.7), inset 0 0 50px rgba(0,0,0,0.35)',
          }}>
            {/* Center info */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: 1, lineHeight: 1 }}>
                Pack {currentStep.pack}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
                Pick {currentStep.pick}{packSize > 0 ? ` of ${packSize}` : ''}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: 0.5 }}>
                {passesLeft ? '← passing left' : 'passing right →'}
              </div>
            </div>
          </div>

          {/* Seats */}
          {Array.from({ length: numSeats }, (_, seatIndex) => {
            const pos = seatPositions[seatIndex]!;
            const state = seatStates.get(seatIndex);
            const colorCodes = archetypeColorCodes(state?.archetype);
            const borderCol = seatBorderColor(colorCodes);
            const currentOracle = state?.currentPick ?? null;
            // Show last 8 previous picks, newest first
            const recentPrev = (state?.prevPicks ?? []).slice(-8).reverse();
            const pickCount = (state?.prevPicks.length ?? 0) + (currentOracle ? 1 : 0);

            return (
              <div
                key={seatIndex}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  transform: 'translate(-50%, -50%)',
                  width: SEAT_W,
                  borderRadius: 8,
                  border: `2px solid ${borderCol}`,
                  background: 'rgba(12, 14, 18, 0.94)',
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 6px 20px rgba(0,0,0,0.55), 0 0 14px ${borderCol}44`,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Seat header */}
                <div style={{
                  padding: '4px 7px',
                  background: 'rgba(255,255,255,0.055)',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 }}>
                    Seat {seatIndex + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {pickCount > 0 && (
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{pickCount}</span>
                    )}
                    {colorCodes.map((c) => (
                      <span
                        key={c}
                        style={{
                          width: 9, height: 9,
                          borderRadius: '50%',
                          background: MTG_COLORS[c]?.bg ?? '#888',
                          display: 'inline-block',
                          boxShadow: `0 0 4px ${MTG_COLORS[c]?.bg ?? '#888'}88`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Current pick */}
                <div style={{ padding: '7px 7px 3px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  {currentOracle ? (
                    <>
                      <img
                        key={`pick-${seatIndex}-${stepIndex}`}
                        src={cardImg(currentOracle)}
                        alt={cardName(currentOracle)}
                        title={cardName(currentOracle)}
                        style={{
                          width: CARD_W,
                          height: CARD_H,
                          borderRadius: 4,
                          objectFit: 'cover',
                          animation: 'draftPickIn 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                          boxShadow: `0 0 16px ${borderCol}66, 0 4px 10px rgba(0,0,0,0.65)`,
                        }}
                      />
                      <div style={{
                        fontSize: 9,
                        color: 'rgba(255,255,255,0.65)',
                        textAlign: 'center',
                        lineHeight: 1.3,
                        maxWidth: SEAT_W - 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {cardName(currentOracle)}
                      </div>
                    </>
                  ) : (
                    <div style={{
                      width: CARD_W,
                      height: CARD_H,
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px dashed rgba(255,255,255,0.12)',
                    }} />
                  )}
                </div>

                {/* Previous picks mini-grid */}
                <div style={{ padding: '2px 5px 6px', display: 'flex', flexWrap: 'wrap', gap: 2, minHeight: recentPrev.length > 0 ? THUMB_H + 6 : 0 }}>
                  {recentPrev.map((oracle, idx) => (
                    <img
                      key={`${oracle}-${idx}`}
                      src={cardImg(oracle)}
                      alt={cardName(oracle)}
                      title={cardName(oracle)}
                      loading="lazy"
                      style={{
                        width: THUMB_W,
                        height: THUMB_H,
                        borderRadius: 2,
                        objectFit: 'cover',
                        opacity: 0.78,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
        <span>
          Draft {draftIndex + 1} of {numDrafts} · {numSeats} seats · {steps.length} picks total
        </span>
        <span className="flex items-center gap-2 flex-wrap">
          {Array.from(seatStates.entries()).map(([seat, state]) => {
            const codes = archetypeColorCodes(state.archetype);
            return (
              <span key={seat} className="flex items-center gap-1">
                <span className="opacity-50">S{seat + 1}</span>
                {codes.map((c) => (
                  <span
                    key={c}
                    style={{
                      width: 7, height: 7,
                      borderRadius: '50%',
                      background: MTG_COLORS[c]?.bg ?? '#888',
                      display: 'inline-block',
                    }}
                  />
                ))}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
};

export default DraftTableView;
