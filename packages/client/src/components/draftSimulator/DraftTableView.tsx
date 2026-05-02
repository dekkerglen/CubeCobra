import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CardMeta, SlimPool } from '@utils/datatypes/SimulationReport';

import { MTG_COLORS } from './SimulatorCharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPEEDS = [
  { label: 'Slow', ms: 2400 },
  { label: 'Med', ms: 1100 },
  { label: 'Fast', ms: 450 },
];

const CARD_W = 76;
const CARD_H = Math.round(CARD_W * (88 / 63)); // ≈ 106px
const THUMB_W = 38;
const THUMB_H = Math.round(THUMB_W * (88 / 63)); // ≈ 53px
const PILE_CARD_W = 88;
const PILE_CARD_H = Math.round(PILE_CARD_W * (88 / 63));

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function archetypeColorCodes(archetype: string | undefined): string[] {
  if (!archetype) return ['C'];
  const colors = archetype.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return colors.length > 0 ? colors : ['C'];
}

function buildPackContents(
  draftSeatPicks: Map<number, SlimPool['picks']>,
  viewSeat: number,
  pack: number,
  pick: number,
  numSeats: number,
  packSize: number,
): { oracle_id: string; pickedBy: number; pickedAtPick: number; isThisPick: boolean }[] {
  const passLeft = pack % 2 === 1;
  const originalOwner = passLeft
    ? (viewSeat + pick - 1 + numSeats) % numSeats
    : (viewSeat - pick + 1 + numSeats) % numSeats;

  const result: { oracle_id: string; pickedBy: number; pickedAtPick: number; isThisPick: boolean }[] = [];
  for (let k = 1; k <= packSize; k++) {
    const holder = passLeft
      ? (originalOwner - (k - 1) + numSeats) % numSeats
      : (originalOwner + (k - 1)) % numSeats;
    const p = (draftSeatPicks.get(holder) ?? []).find((x) => x.packNumber === pack && x.pickNumber === k);
    if (p)
      result.push({ oracle_id: p.oracle_id, pickedBy: holder, pickedAtPick: k, isThisPick: holder === viewSeat && k === pick });
  }
  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step { pack: number; pick: number }
interface SeatState { currentPick: string | null; prevPicks: string[]; archetype: string }
interface PackView { seatIndex: number; pack: number; pick: number }

// ─── Pick pile overlay ────────────────────────────────────────────────────────

const PickPileOverlay: React.FC<{
  seatIndex: number;
  archetype: string;
  draftSeatPicks: Map<number, SlimPool['picks']>;
  steps: Step[];
  stepIndex: number;
  cardMeta: Record<string, CardMeta>;
  onClose: () => void;
}> = ({ seatIndex, archetype, draftSeatPicks, steps, stepIndex, cardMeta, onClose }) => {
  const colorCodes = archetypeColorCodes(archetype);
  const accentColor = MTG_COLORS[colorCodes[0]]?.bg ?? '#6b7280';

  const picksUpToNow = useMemo(() => {
    const allPicks = draftSeatPicks.get(seatIndex) ?? [];
    return allPicks
      .filter((p) => {
        const idx = steps.findIndex((s) => s.pack === p.packNumber && s.pick === p.pickNumber);
        return idx <= stepIndex;
      })
      .sort((a, b) => a.packNumber !== b.packNumber ? a.packNumber - b.packNumber : a.pickNumber - b.pickNumber);
  }, [draftSeatPicks, seatIndex, steps, stepIndex]);

  const currentStepEntry = steps[stepIndex];
  const byPack = useMemo(() => {
    const map = new Map<number, typeof picksUpToNow>();
    for (const p of picksUpToNow) {
      const arr = map.get(p.packNumber) ?? [];
      arr.push(p);
      map.set(p.packNumber, arr);
    }
    return map;
  }, [picksUpToNow]);

  const cardImg = (oracle: string) => cardMeta[oracle]?.imageUrl ?? `/tool/cardimage/${encodeURIComponent(oracle)}`;
  const cardName = (oracle: string) => cardMeta[oracle]?.name ?? oracle;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#141619', borderRadius: 10, border: `1px solid ${accentColor}44`, borderLeft: `4px solid ${accentColor}`, boxShadow: '0 24px 60px rgba(0,0,0,0.8)', maxWidth: 820, width: '100%', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'packFadeIn 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Seat {seatIndex + 1}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {colorCodes.map((c) => (
                <span key={c} title={c} style={{ width: 9, height: 9, borderRadius: '50%', background: MTG_COLORS[c]?.bg ?? '#888', display: 'inline-block' }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
              {picksUpToNow.length} pick{picksUpToNow.length !== 1 ? 's' : ''}
              {currentStepEntry && ` · through P${currentStepEntry.pack}P${currentStepEntry.pick}`}
            </span>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '4px 9px', flexShrink: 0 }}>
            ✕
          </button>
        </div>

        {/* Picks by pack */}
        <div style={{ overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {picksUpToNow.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, paddingTop: 20 }}>
              No picks yet
            </div>
          )}
          {Array.from(byPack.entries()).map(([packNum, packPicks]) => (
            <div key={packNum}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Pack {packNum}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {packPicks.map((pick) => {
                  const isCurrent = currentStepEntry?.pack === pick.packNumber && currentStepEntry?.pick === pick.pickNumber;
                  return (
                    <div key={`${pick.packNumber}-${pick.pickNumber}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: PILE_CARD_W }}>
                      <div style={{ position: 'relative' }}>
                        <img
                          src={cardImg(pick.oracle_id)}
                          alt={cardName(pick.oracle_id)}
                          title={cardName(pick.oracle_id)}
                          style={{ width: PILE_CARD_W, height: PILE_CARD_H, borderRadius: 5, objectFit: 'cover', border: isCurrent ? '2px solid #f5c842' : `1px solid ${accentColor}33`, boxShadow: isCurrent ? '0 0 10px #f5c84255' : undefined }}
                        />
                        {isCurrent && (
                          <div style={{ position: 'absolute', top: -6, right: -6, background: '#f5c842', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#000' }}>★</div>
                        )}
                        <div style={{ position: 'absolute', bottom: 3, left: 3, background: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '1px 4px', fontSize: 9, color: isCurrent ? '#f5c842' : 'rgba(255,255,255,0.55)', lineHeight: 1.4, fontWeight: isCurrent ? 700 : 400 }}>
                          P{pick.pickNumber}
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: isCurrent ? '#f5c842' : 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.3, maxWidth: PILE_CARD_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cardName(pick.oracle_id)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#141619', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 60px rgba(0,0,0,0.8)', maxWidth: 780, width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'packFadeIn 0.22s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Pack {packView.pack} · Pick {packView.pick} — Seat {packView.seatIndex + 1}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              ★ picked · faded = already taken · normal = passed on
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '4px 9px' }}>
            ✕
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {cards.map((card) => {
              const alreadyTaken = card.pickedAtPick < packView.pick;
              return (
                <div key={`${card.oracle_id}-${card.pickedAtPick}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: PACK_CARD_W }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={cardImg(card.oracle_id)} alt={cardName(card.oracle_id)} title={cardName(card.oracle_id)}
                      style={{ width: PACK_CARD_W, height: PACK_CARD_H, borderRadius: 5, objectFit: 'cover', opacity: alreadyTaken ? 0.3 : 1, border: card.isThisPick ? '2px solid #f5c842' : alreadyTaken ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent', boxShadow: card.isThisPick ? '0 0 10px #f5c84255' : undefined }}
                    />
                    {card.isThisPick && (
                      <div style={{ position: 'absolute', top: -6, right: -6, background: '#f5c842', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#000' }}>★</div>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: card.isThisPick ? '#f5c842' : alreadyTaken ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.3, maxWidth: PACK_CARD_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.isThisPick ? '★ Picked' : alreadyTaken ? `S${card.pickedBy + 1}·P${card.pickedAtPick}` : `→ S${card.pickedBy + 1}·P${card.pickedAtPick}`}
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

// ─── Seat panel ───────────────────────────────────────────────────────────────

const SeatPanel: React.FC<{
  seatIndex: number;
  state: SeatState;
  stepIndex: number;
  currentStep: Step;
  cardMeta: Record<string, CardMeta>;
  onClickPick: (packView: PackView) => void;
  onOpenPile: () => void;
  isActive: boolean;
  anyActive: boolean;
}> = ({ seatIndex, state, stepIndex, currentStep, cardMeta, onClickPick, onOpenPile, isActive, anyActive }) => {
  const colorCodes = archetypeColorCodes(state.archetype);
  const accentColor = MTG_COLORS[colorCodes[0]]?.bg ?? '#6b7280';
  const currentOracle = state.currentPick;
  const recentPrev = state.prevPicks.slice(-14).reverse();
  const pickCount = state.prevPicks.length + (currentOracle ? 1 : 0);

  const cardImg = (oracle: string) => cardMeta[oracle]?.imageUrl ?? `/tool/cardimage/${encodeURIComponent(oracle)}`;
  const cardName = (oracle: string) => cardMeta[oracle]?.name ?? oracle;

  const dimmed = anyActive && !isActive;

  return (
    <div
      onClick={onOpenPile}
      style={{
        borderRadius: 7,
        borderTop: `1px solid ${isActive ? `${accentColor}55` : 'rgba(255,255,255,0.08)'}`,
        borderRight: `1px solid ${isActive ? `${accentColor}55` : 'rgba(255,255,255,0.08)'}`,
        borderBottom: `1px solid ${isActive ? `${accentColor}55` : 'rgba(255,255,255,0.08)'}`,
        borderLeft: `3px solid ${accentColor}`,
        background: isActive ? 'rgba(22, 27, 35, 0.97)' : 'rgba(16, 20, 26, 0.85)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        opacity: dimmed ? 0.42 : 1,
        transition: 'opacity 0.18s, background 0.18s',
        cursor: 'pointer',
        boxShadow: isActive ? '0 3px 12px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.2)',
      }}
      title="Click to see full pick pile"
    >
      {/* Current pick — click to view pack */}
      <div
        style={{ flexShrink: 0, padding: '6px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: currentOracle ? 'pointer' : 'default' }}
        onClick={(e) => { e.stopPropagation(); currentOracle && onClickPick({ seatIndex, pack: currentStep.pack, pick: currentStep.pick }); }}
        title={currentOracle ? 'Click to view full pack' : undefined}
      >
        <div style={{ fontSize: 8, fontWeight: 500, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1, height: 11, display: 'flex', alignItems: 'center' }}>
          {currentOracle ? 'Current pick' : ''}
        </div>
        {currentOracle ? (
          <div style={{ position: 'relative' }}>
            <img
              key={`pick-${seatIndex}-${stepIndex}`}
              src={cardImg(currentOracle)}
              alt={cardName(currentOracle)}
              style={{ width: CARD_W, height: CARD_H, borderRadius: 4, objectFit: 'cover', display: 'block', animation: 'draftPickIn 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275)', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', border: `1px solid ${accentColor}55` }}
            />
            <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: '1px 3px', fontSize: 8, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>🔍</div>
          </div>
        ) : (
          <div style={{ width: CARD_W, height: CARD_H, borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.07)' }} />
        )}
      </div>

      {/* Info column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '7px 8px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}>
            Seat {seatIndex + 1}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {pickCount > 0 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
                {pickCount}
              </span>
            )}
            {colorCodes.map((c) => (
              <span key={c} title={c} style={{ width: 8, height: 8, borderRadius: '50%', background: MTG_COLORS[c]?.bg ?? '#888', display: 'inline-block', flexShrink: 0 }} />
            ))}
          </div>
        </div>

        {/* Previous picks */}
        <div style={{ flex: 1, padding: '5px 6px 5px', display: 'flex', flexWrap: 'wrap', gap: 2, alignContent: 'flex-start', overflow: 'hidden' }}>
          {recentPrev.map((oracle, idx) => (
            <img
              key={`${oracle}-${idx}`}
              src={cardImg(oracle)}
              alt=""
              title={cardName(oracle)}
              loading="lazy"
              style={{ width: THUMB_W, height: THUMB_H, borderRadius: 2, objectFit: 'cover', opacity: 0.7, border: '1px solid rgba(255,255,255,0.06)' }}
            />
          ))}
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
  const [pileViewSeat, setPileViewSeat] = useState<number | null>(null);
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

  useEffect(() => { setStepIndex(0); setIsPlaying(false); setPackView(null); setPileViewSeat(null); }, [draftIndex]);

  const draftOptions = useMemo(
    () => Array.from({ length: numDrafts }, (_, i) => ({ value: String(i), label: `Draft ${i + 1}` })),
    [numDrafts],
  );

  const leftCount = Math.ceil(numSeats / 2);
  const leftSeats = Array.from({ length: leftCount }, (_, i) => i);
  const rightSeats = Array.from({ length: numSeats - leftCount }, (_, i) => leftCount + i);

  const renderSeat = (seat: number) => {
    const state = seatStates.get(seat);
    if (!state) return null;
    return (
      <SeatPanel
        key={seat}
        seatIndex={seat}
        state={state}
        stepIndex={stepIndex}
        currentStep={currentStep}
        cardMeta={cardMeta}
        onClickPick={setPackView}
        onOpenPile={() => setPileViewSeat(seat)}
        isActive={pileViewSeat === seat}
        anyActive={pileViewSeat !== null}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3 select-none">
      <style>{ANIM_CSS}</style>

      {pileViewSeat !== null && (
        <PickPileOverlay
          seatIndex={pileViewSeat}
          archetype={seatArchetypes.get(pileViewSeat) ?? ''}
          draftSeatPicks={draftSeatPicks}
          steps={steps}
          stepIndex={stepIndex}
          cardMeta={cardMeta}
          onClose={() => setPileViewSeat(null)}
        />
      )}

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

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap py-0.5">

        {/* Left group: draft select · playback · speed */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={String(draftIndex)}
            onChange={(e) => setDraftIndex(Number(e.target.value))}
            className="rounded border border-border bg-bg text-sm px-2 py-1 text-text"
          >
            {draftOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Playback as a connected button group */}
          <div className="flex">
            <button type="button" onClick={() => nudge(-1)} disabled={stepIndex === 0}
              className="px-2 py-1 text-base rounded-l border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none">
              ‹
            </button>
            <button type="button"
              onClick={() => { if (stepIndex >= maxStep) setStepIndex(0); setIsPlaying((p) => !p); }}
              className="px-3 py-1 text-sm -ml-px border border-border bg-bg hover:bg-bg-active text-text min-w-[72px] text-center">
              {isPlaying ? '⏸ Pause' : stepIndex >= maxStep ? '↺ Replay' : '▶ Play'}
            </button>
            <button type="button" onClick={() => nudge(1)} disabled={stepIndex >= maxStep}
              className="px-2 py-1 text-base rounded-r -ml-px border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none">
              ›
            </button>
          </div>

          {/* Speed — segmented control */}
          <div className="flex">
            {SPEEDS.map((s, i) => (
              <button key={s.label} type="button" onClick={() => setSpeedIndex(i)}
                className={[
                  'px-2.5 py-1 text-xs font-medium border',
                  i === 0 ? 'rounded-l' : i === SPEEDS.length - 1 ? 'rounded-r -ml-px' : '-ml-px',
                  speedIndex === i
                    ? 'border-link text-link bg-link/10 relative z-10'
                    : 'border-border text-text-secondary bg-bg hover:bg-bg-active hover:text-text',
                ].join(' ')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right group: scrubber · step label */}
        <div className="flex items-center gap-2 ml-auto">
          <input type="range" min={0} max={maxStep} value={stepIndex}
            onChange={(e) => { setIsPlaying(false); setStepIndex(Number(e.target.value)); }}
            className="w-44 accent-link" />
          <span className="text-xs text-text-secondary whitespace-nowrap tabular-nums font-mono">
            P{currentStep.pack}·P{currentStep.pick} {stepIndex + 1}/{steps.length}
          </span>
        </div>
      </div>

      {/* ── Table layout ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch">

        {/* Left column */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {leftSeats.map(renderSeat)}
        </div>

        {/* Center: pack info */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center" style={{ minWidth: 118 }}>
          <div style={{
            background: '#182b1e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '18px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Pack {currentStep.pack}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {currentStep.pick}
              {packSize > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>of {packSize}</span>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 5 }}>
              {passesLeft && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>←</span>}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500, letterSpacing: 0.3 }}>
                {passesLeft ? 'Passing left' : 'Passing right'}
              </span>
              {!passesLeft && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>→</span>}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {rightSeats.map(renderSeat)}
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-text-secondary">
        Draft {draftIndex + 1} of {numDrafts} · {numSeats} seats · {steps.length} picks · click a seat to see their picks · click the card to see the full pack
      </div>
    </div>
  );
};

export default DraftTableView;
