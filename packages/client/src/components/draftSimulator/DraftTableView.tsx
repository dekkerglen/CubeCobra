import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CardMeta, SlimPool } from '@utils/datatypes/SimulationReport';

import { MTG_COLORS } from './SimulatorCharts';

// ─── Layout constants ────────────────────────────────────────────────────────

const CW = 1120;
const CH = 680;
const TCX = CW / 2;
const TCY = CH / 2;
const TRX = 230;
const TRY = 130;
const SRX = 420;
const SRY = 245;
const SEAT_W = 152;
const CARD_W = 74;
const CARD_H = Math.round(CARD_W * (88 / 63)); // ≈ 103px
const THUMB_W = 32;
const THUMB_H = Math.round(THUMB_W * (88 / 63)); // ≈ 45px

const SPEEDS = [
  { label: 'Slow', ms: 2400 },
  { label: 'Medium', ms: 1100 },
  { label: 'Fast', ms: 450 },
];

const ANIM_CSS = `
@keyframes draftPickIn {
  from { opacity: 0; transform: scale(0.6) translateY(-14px) rotate(-7deg); }
  to   { opacity: 1; transform: scale(1)   translateY(0)     rotate(0deg);  }
}
@keyframes packFadeIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);   }
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
  return MTG_COLORS[codes[0]]?.bg ?? '#666';
}

// Reconstruct the full pack that seat `viewSeat` saw at the given (pack, pick).
// Standard booster draft passing: odd packs pass left (seat index decreases), even pass right.
function buildPackContents(
  draftSeatPicks: Map<number, SlimPool['picks']>,
  viewSeat: number,
  pack: number,
  pick: number,
  numSeats: number,
  packSize: number,
): { oracle_id: string; pickedBy: number; pickedAtPick: number; isThisPick: boolean }[] {
  const passLeft = pack % 2 === 1;
  // Original pack opener: the seat whose pack flowed to viewSeat by pick K
  const originalOwner = passLeft
    ? (viewSeat + pick - 1 + numSeats) % numSeats
    : (viewSeat - pick + 1 + numSeats) % numSeats;

  const result: { oracle_id: string; pickedBy: number; pickedAtPick: number; isThisPick: boolean }[] = [];
  for (let k = 1; k <= packSize; k++) {
    // Which seat holds that pack at pick k?
    const holder = passLeft
      ? (originalOwner - (k - 1) + numSeats) % numSeats
      : (originalOwner + (k - 1)) % numSeats;
    const seatPicks = draftSeatPicks.get(holder) ?? [];
    const p = seatPicks.find((x) => x.packNumber === pack && x.pickNumber === k);
    if (p) {
      result.push({ oracle_id: p.oracle_id, pickedBy: holder, pickedAtPick: k, isThisPick: holder === viewSeat && k === pick });
    }
  }
  return result;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step { pack: number; pick: number }
interface SeatState { currentPick: string | null; prevPicks: string[]; archetype: string }
interface PackView { seatIndex: number; pack: number; pick: number }

// ─── Pack overlay ─────────────────────────────────────────────────────────────

const PACK_CARD_W = 88;
const PACK_CARD_H = Math.round(PACK_CARD_W * (88 / 63));

const PackOverlay: React.FC<{
  packView: PackView;
  draftSeatPicks: Map<number, SlimPool['picks']>;
  numSeats: number;
  packSize: number;
  cardMeta: Record<string, CardMeta>;
  onClose: () => void;
}> = ({ packView, draftSeatPicks, numSeats, packSize, cardMeta, onClose }) => {
  const cards = useMemo(
    () => buildPackContents(draftSeatPicks, packView.seatIndex, packView.pack, packView.pick, numSeats, packSize),
    [draftSeatPicks, packView, numSeats, packSize],
  );

  const cardImg = (oracle: string) => cardMeta[oracle]?.imageUrl ?? `/tool/cardimage/${encodeURIComponent(oracle)}`;
  const cardName = (oracle: string) => cardMeta[oracle]?.name ?? oracle;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#141619',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          maxWidth: 780,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'packFadeIn 0.22s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              Pack {packView.pack}, Pick {packView.pick} — Seat {packView.seatIndex + 1}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {packSize} cards · gold border = picked · faded = already taken
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '4px 10px',
            }}
          >✕</button>
        </div>

        {/* Card grid */}
        <div style={{ overflowY: 'auto', padding: '16px 18px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {cards.map((card) => {
              const alreadyTaken = card.pickedAtPick < packView.pick;
              const isThisPick = card.isThisPick;
              return (
                <div key={`${card.oracle_id}-${card.pickedAtPick}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: PACK_CARD_W }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={cardImg(card.oracle_id)}
                      alt={cardName(card.oracle_id)}
                      title={cardName(card.oracle_id)}
                      style={{
                        width: PACK_CARD_W,
                        height: PACK_CARD_H,
                        borderRadius: 5,
                        objectFit: 'cover',
                        opacity: alreadyTaken ? 0.38 : 1,
                        border: isThisPick
                          ? '3px solid #f5c842'
                          : alreadyTaken
                          ? '2px solid rgba(255,255,255,0.08)'
                          : '2px solid transparent',
                        boxShadow: isThisPick ? '0 0 14px #f5c84288' : undefined,
                        transition: 'opacity 0.15s',
                      }}
                    />
                    {isThisPick && (
                      <div style={{
                        position: 'absolute', top: -6, right: -6,
                        background: '#f5c842', borderRadius: '50%',
                        width: 18, height: 18,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#000',
                      }}>★</div>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: isThisPick ? '#f5c842' : alreadyTaken ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.3, maxWidth: PACK_CARD_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isThisPick ? '★ Picked' : alreadyTaken ? `Taken — S${card.pickedBy + 1} P${card.pickedAtPick}` : `→ S${card.pickedBy + 1} P${card.pickedAtPick}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [packView, setPackView] = useState<PackView | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const seatArchetypes = useMemo(() => {
    const map = new Map<number, string>();
    for (const pool of slimPools) {
      if (pool.draftIndex === draftIndex) map.set(pool.seatIndex, pool.archetype ?? '');
    }
    return map;
  }, [slimPools, draftIndex]);

  const steps = useMemo<Step[]>(() => {
    const seen = new Set<string>();
    const arr: Step[] = [];
    for (const picks of draftSeatPicks.values()) {
      for (const p of picks) {
        const key = `${p.packNumber}:${p.pickNumber}`;
        if (!seen.has(key)) { seen.add(key); arr.push({ pack: p.packNumber, pick: p.pickNumber }); }
      }
    }
    return arr.sort((a, b) => a.pack !== b.pack ? a.pack - b.pack : a.pick - b.pick);
  }, [draftSeatPicks]);

  const maxStep = Math.max(0, steps.length - 1);
  const currentStep = steps[stepIndex] ?? { pack: 1, pick: 1 };
  const packSize = useMemo(() => steps.filter((s) => s.pack === 1).length, [steps]);
  const passesLeft = currentStep.pack % 2 === 1;

  const seatStates = useMemo<Map<number, SeatState>>(() => {
    const result = new Map<number, SeatState>();
    for (let seat = 0; seat < numSeats; seat++) {
      const picks = draftSeatPicks.get(seat) ?? [];
      let currentPick: string | null = null;
      const prevPicks: string[] = [];
      for (const p of picks) {
        const pIdx = steps.findIndex((s) => s.pack === p.packNumber && s.pick === p.pickNumber);
        if (pIdx < stepIndex) prevPicks.push(p.oracle_id);
        else if (pIdx === stepIndex) currentPick = p.oracle_id;
      }
      result.set(seat, { currentPick, prevPicks, archetype: seatArchetypes.get(seat) ?? '' });
    }
    return result;
  }, [draftSeatPicks, stepIndex, steps, seatArchetypes, numSeats]);

  const seatPositions = useMemo(() => getSeatPositions(numSeats), [numSeats]);

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

  useEffect(() => { setStepIndex(0); setIsPlaying(false); setPackView(null); }, [draftIndex]);

  const cardImg = (oracle: string) => cardMeta[oracle]?.imageUrl ?? `/tool/cardimage/${encodeURIComponent(oracle)}`;
  const cardName = (oracle: string) => cardMeta[oracle]?.name ?? oracle;

  const draftOptions = useMemo(
    () => Array.from({ length: numDrafts }, (_, i) => ({ value: String(i), label: `Draft ${i + 1}` })),
    [numDrafts],
  );

  return (
    <div className="flex flex-col gap-3 select-none">
      <style>{ANIM_CSS}</style>

      {/* Pack overlay */}
      {packView && (
        <PackOverlay
          packView={packView}
          draftSeatPicks={draftSeatPicks}
          numSeats={numSeats}
          packSize={packSize}
          cardMeta={cardMeta}
          onClose={() => setPackView(null)}
        />
      )}

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={String(draftIndex)}
          onChange={(e) => setDraftIndex(Number(e.target.value))}
          className="rounded border border-border bg-bg text-sm px-2 py-1 text-text"
        >
          {draftOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => nudge(-1)} disabled={stepIndex === 0}
            className="px-2 py-1 text-base rounded border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none">‹</button>
          <button type="button"
            onClick={() => { if (stepIndex >= maxStep) setStepIndex(0); setIsPlaying((p) => !p); }}
            className="px-3 py-1 text-sm rounded border border-border bg-bg hover:bg-bg-active text-text min-w-[72px] text-center">
            {isPlaying ? '⏸ Pause' : stepIndex >= maxStep ? '↺ Replay' : '▶ Play'}
          </button>
          <button type="button" onClick={() => nudge(1)} disabled={stepIndex >= maxStep}
            className="px-2 py-1 text-base rounded border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none">›</button>
        </div>

        <div className="flex items-center gap-1">
          {SPEEDS.map((s, i) => (
            <button key={s.label} type="button" onClick={() => setSpeedIndex(i)}
              className={['px-2 py-0.5 text-xs rounded border', speedIndex === i ? 'border-link text-link bg-link/10' : 'border-border text-text-secondary hover:text-text hover:bg-bg-active'].join(' ')}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input type="range" min={0} max={maxStep} value={stepIndex}
            onChange={(e) => { setIsPlaying(false); setStepIndex(Number(e.target.value)); }}
            className="w-52 accent-link" />
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
            left: TCX - TRX, top: TCY - TRY,
            width: TRX * 2, height: TRY * 2,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 38% 32%, #2e9142 0%, #1d6a2e 50%, #124820 100%)',
            border: '6px solid #7a6040',
            boxShadow: '0 0 0 2px #5a4428, 0 12px 40px rgba(0,0,0,0.7), inset 0 0 50px rgba(0,0,0,0.35)',
          }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: 1, lineHeight: 1 }}>
                Pack {currentStep.pack}
              </div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
                Pick {currentStep.pick}{packSize > 0 ? ` of ${packSize}` : ''}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>
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
            const recentPrev = (state?.prevPicks ?? []).slice(-8).reverse();
            const pickCount = (state?.prevPicks.length ?? 0) + (currentOracle ? 1 : 0);

            return (
              <div key={seatIndex} style={{
                position: 'absolute',
                left: pos.x, top: pos.y,
                transform: 'translate(-50%, -50%)',
                width: SEAT_W,
                borderRadius: 8,
                border: `2px solid ${borderCol}`,
                background: 'rgba(12, 14, 18, 0.94)',
                boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 6px 20px rgba(0,0,0,0.55), 0 0 14px ${borderCol}44`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Header */}
                <div style={{ padding: '4px 7px', background: 'rgba(255,255,255,0.055)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 }}>
                    Seat {seatIndex + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {pickCount > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{pickCount}</span>}
                    {colorCodes.map((c) => (
                      <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: MTG_COLORS[c]?.bg ?? '#888', display: 'inline-block', boxShadow: `0 0 4px ${MTG_COLORS[c]?.bg ?? '#888'}88` }} />
                    ))}
                  </div>
                </div>

                {/* Current pick — clickable to view full pack */}
                <div style={{ padding: '7px 7px 3px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  {currentOracle ? (
                    <>
                      <div
                        style={{ position: 'relative', cursor: 'pointer' }}
                        title="Click to view full pack"
                        onClick={() => setPackView({ seatIndex, pack: currentStep.pack, pick: currentStep.pick })}
                      >
                        <img
                          key={`pick-${seatIndex}-${stepIndex}`}
                          src={cardImg(currentOracle)}
                          alt={cardName(currentOracle)}
                          style={{
                            width: CARD_W, height: CARD_H,
                            borderRadius: 4, objectFit: 'cover',
                            animation: 'draftPickIn 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            boxShadow: `0 0 16px ${borderCol}66, 0 4px 10px rgba(0,0,0,0.65)`,
                            display: 'block',
                          }}
                        />
                        {/* Magnifier hint */}
                        <div style={{
                          position: 'absolute', bottom: 3, right: 3,
                          background: 'rgba(0,0,0,0.65)',
                          borderRadius: 3, padding: '1px 3px',
                          fontSize: 9, color: 'rgba(255,255,255,0.7)',
                          lineHeight: 1.4, pointerEvents: 'none',
                        }}>🔍</div>
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 1.3, maxWidth: SEAT_W - 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cardName(currentOracle)}
                      </div>
                    </>
                  ) : (
                    <div style={{ width: CARD_W, height: CARD_H, borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)' }} />
                  )}
                </div>

                {/* Previous picks mini-grid */}
                <div style={{ padding: '2px 5px 6px', display: 'flex', flexWrap: 'wrap', gap: 2, minHeight: recentPrev.length > 0 ? THUMB_H + 6 : 0 }}>
                  {recentPrev.map((oracle, idx) => (
                    <img key={`${oracle}-${idx}`} src={cardImg(oracle)} alt={cardName(oracle)} title={cardName(oracle)}
                      loading="lazy"
                      style={{ width: THUMB_W, height: THUMB_H, borderRadius: 2, objectFit: 'cover', opacity: 0.78 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
        <span>Draft {draftIndex + 1} of {numDrafts} · {numSeats} seats · {steps.length} picks total · click any card to see full pack</span>
        <span className="flex items-center gap-2 flex-wrap">
          {Array.from(seatStates.entries()).map(([seat, state]) => {
            const codes = archetypeColorCodes(state.archetype);
            return (
              <span key={seat} className="flex items-center gap-1">
                <span className="opacity-50">S{seat + 1}</span>
                {codes.map((c) => (
                  <span key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: MTG_COLORS[c]?.bg ?? '#888', display: 'inline-block' }} />
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
