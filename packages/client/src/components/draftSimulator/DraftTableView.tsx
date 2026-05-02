import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CardMeta, SimulationRunData, SlimPool } from '@utils/datatypes/SimulationReport';

import { buildOracleRemapping, loadDraftBot, localBatchDraftRanked } from '../../utils/draftBot';
import { MTG_COLORS } from './SimulatorCharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPEEDS = [
  { label: 'Slow', ms: 2400 },
  { label: 'Med', ms: 1100 },
  { label: 'Fast', ms: 450 },
];

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * (88 / 63));
const THUMB_W = 44;
const THUMB_H = Math.round(THUMB_W * (88 / 63));
const PILE_CARD_W = 88;
const PILE_CARD_H = Math.round(PILE_CARD_W * (88 / 63));
const PACK_CARD_W = 96;
const PACK_CARD_H = Math.round(PACK_CARD_W * (88 / 63));

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

function softmaxPcts(ratings: number[]): number[] {
  if (ratings.length === 0) return [];
  const max = Math.max(...ratings);
  const exps = ratings.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => (v / sum) * 100);
}

function buildPackContents(
  runData: SimulationRunData,
  draftIndex: number,
  viewSeat: number,
  pack: number,
  pick: number,
  numSeats: number,
): { oracle_id: string; pickedBy: number | null; pickedAtPick: number; isThisPick: boolean; wasTrashed: boolean }[] {
  const setup = runData.setupData;
  if (!setup) return [];

  type PackEvent = { pickedBy: number | null; pickedAtPick: number; wasTrashed: boolean };
  type PackTracker = {
    originalCards: string[];
    cards: string[];
    events: Map<string, PackEvent>;
  };

  const orderedPicksByPool = runData.slimPools.map((slim) =>
    [...slim.picks].sort((a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber),
  );
  const pickPointers = new Array(runData.slimPools.length).fill(0);
  const randomTrashPointers = new Array(runData.slimPools.length).fill(0);

  let targetPack: PackTracker | null = null;
  let snapshotCards: string[] = [];

  for (let packNum = 0; packNum <= pack; packNum++) {
    let currentPacks: PackTracker[] = Array.from({ length: numSeats }, (_, seatIndex) => {
      const cards = [...(setup.initialPacks[draftIndex]?.[seatIndex]?.[packNum] ?? [])];
      return { originalCards: [...cards], cards, events: new Map() };
    });

    const steps = setup.packSteps[packNum] ?? [];
    let pickNumInPack = 1;

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicks = step.amount ?? 1;
        for (let pickStep = 0; pickStep < numPicks; pickStep++) {
          if (packNum === pack && pickNumInPack === pick) {
            targetPack = currentPacks[viewSeat] ?? null;
            snapshotCards = targetPack ? [...targetPack.cards] : [];
          }

          for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
            const poolIndex = draftIndex * numSeats + seatIndex;
            const packTracker = currentPacks[seatIndex];
            const nextPick = orderedPicksByPool[poolIndex]?.[pickPointers[poolIndex] ?? 0];
            if (!packTracker || !nextPick) continue;

            pickPointers[poolIndex] = (pickPointers[poolIndex] ?? 0) + 1;
            if (nextPick.packNumber !== packNum || nextPick.pickNumber !== pickNumInPack) continue;

            packTracker.events.set(nextPick.oracle_id, {
              pickedBy: seatIndex,
              pickedAtPick: pickNumInPack,
              wasTrashed: false,
            });

            const removeIdx = packTracker.cards.indexOf(nextPick.oracle_id);
            if (removeIdx >= 0) packTracker.cards.splice(removeIdx, 1);
          }
          pickNumInPack++;
        }
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        const numTrash = step.amount ?? 1;
        for (let trashStep = 0; trashStep < numTrash; trashStep++) {
          for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
            const poolIndex = draftIndex * numSeats + seatIndex;
            const packTracker = currentPacks[seatIndex];
            if (!packTracker || packTracker.cards.length === 0) continue;

            let trashedOracle: string | undefined;
            if (step.action === 'trashrandom') {
              trashedOracle = runData.randomTrashByPool?.[poolIndex]?.[randomTrashPointers[poolIndex] ?? 0];
              randomTrashPointers[poolIndex] = (randomTrashPointers[poolIndex] ?? 0) + 1;
            } else {
              trashedOracle = packTracker.cards[0];
            }

            if (!trashedOracle) continue;
            const removeIdx = packTracker.cards.indexOf(trashedOracle);
            if (removeIdx < 0) continue;

            packTracker.events.set(trashedOracle, {
              pickedBy: null,
              pickedAtPick: pickNumInPack,
              wasTrashed: true,
            });
            packTracker.cards.splice(removeIdx, 1);
          }
          pickNumInPack++;
        }
      } else if (step.action === 'pass') {
        const direction = packNum % 2 === 0 ? 1 : -1;
        const snapshot = currentPacks.map((packTracker) => packTracker);
        currentPacks = currentPacks.map((_, seatIndex) => snapshot[(seatIndex - direction + numSeats) % numSeats]!);
      }
    }
  }

  if (!targetPack) return [];

  const currentCardSet = new Set(snapshotCards);
  return targetPack.originalCards
    .map((oracle_id, originalIndex) => {
      const event = targetPack?.events.get(oracle_id);
      return {
        oracle_id,
        pickedBy: event?.pickedBy ?? null,
        pickedAtPick: event?.pickedAtPick ?? Number.MAX_SAFE_INTEGER,
        isThisPick: currentCardSet.has(oracle_id) && event?.pickedBy === viewSeat && event?.pickedAtPick === pick && !event.wasTrashed,
        wasTrashed: event?.wasTrashed ?? false,
        originalIndex,
      };
    })
    .sort((a, b) => a.pickedAtPick - b.pickedAtPick || a.originalIndex - b.originalIndex)
    .map(({ originalIndex: _originalIndex, ...rest }) => rest);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step { pack: number; pick: number }
interface SeatState { currentPick: string | null; prevPicks: string[]; archetype: string }
interface MlScore { rank: number; pct: number }

// ─── Pick pile overlay ────────────────────────────────────────────────────────

const PickPileOverlay: React.FC<{
  seatIndex: number;
  archetype: string;
  archetypeName: string | null;
  draftSeatPicks: Map<number, SlimPool['picks']>;
  steps: Step[];
  stepIndex: number;
  cardMeta: Record<string, CardMeta>;
  onClose: () => void;
}> = ({ seatIndex, archetype, archetypeName, draftSeatPicks, steps, stepIndex, cardMeta, onClose }) => {
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
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Seat {seatIndex + 1}</span>
            {archetypeName && <span style={{ fontSize: 12, fontWeight: 500, color: accentColor }}>{archetypeName}</span>}
            <div style={{ display: 'flex', gap: 3 }}>
              {colorCodes.map((c) => (
                <span key={c} title={c} style={{ width: 8, height: 8, borderRadius: '50%', background: MTG_COLORS[c]?.bg ?? '#888', display: 'inline-block' }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              {picksUpToNow.length} pick{picksUpToNow.length !== 1 ? 's' : ''}
              {currentStepEntry && ` · through P${currentStepEntry.pack + 1}P${currentStepEntry.pick}`}
            </span>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '4px 9px', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {picksUpToNow.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, paddingTop: 20 }}>No picks yet</div>
          )}
          {Array.from(byPack.entries()).map(([packNum, packPicks]) => (
            <div key={packNum}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Pack {packNum + 1}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {packPicks.map((pick) => {
                  const isCurrent = currentStepEntry?.pack === pick.packNumber && currentStepEntry?.pick === pick.pickNumber;
                  return (
                    <div key={`${pick.packNumber}-${pick.pickNumber}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: PILE_CARD_W }}>
                      <div style={{ position: 'relative' }}>
                        <img src={cardImg(pick.oracle_id)} alt={cardName(pick.oracle_id)} title={cardName(pick.oracle_id)}
                          style={{ width: PILE_CARD_W, height: PILE_CARD_H, borderRadius: 5, objectFit: 'cover', border: isCurrent ? '2px solid #f5c842' : `1px solid ${accentColor}33`, boxShadow: isCurrent ? '0 0 10px #f5c84255' : undefined }} />
                        {isCurrent && (
                          <div style={{ position: 'absolute', top: -6, right: -6, background: '#f5c842', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#000' }}>★</div>
                        )}
                        <div style={{ position: 'absolute', bottom: 3, left: 3, background: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '1px 4px', fontSize: 9, color: isCurrent ? '#f5c842' : 'rgba(255,255,255,0.55)', lineHeight: 1.4, fontWeight: isCurrent ? 700 : 400 }}>
                          P{pick.pickNumber}
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: isCurrent ? '#f5c842' : 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.3, maxWidth: PILE_CARD_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

const PackOverlay: React.FC<{
  draftIndex: number;
  seatIndex: number;
  runData: SimulationRunData;
  currentStep: Step;
  draftSeatPicks: Map<number, SlimPool['picks']>;
  steps: Step[];
  stepIndex: number;
  numSeats: number;
  packSize: number;
  cardMeta: Record<string, CardMeta>;
  archetypeName: string | null;
  onClose: () => void;
}> = ({ draftIndex, seatIndex, runData, currentStep, draftSeatPicks, steps, stepIndex, numSeats, packSize, cardMeta, archetypeName, onClose }) => {
  const [mlScores, setMlScores] = useState<Map<string, MlScore> | null>(null);
  const [mlLoading, setMlLoading] = useState(true);

  const cards = useMemo(
    () => buildPackContents(runData, draftIndex, seatIndex, currentStep.pack, currentStep.pick, numSeats),
    [runData, draftIndex, seatIndex, currentStep, numSeats],
  );

  const seatPool = useMemo(() => {
    const allPicks = draftSeatPicks.get(seatIndex) ?? [];
    return allPicks
      .filter((p) => {
        const idx = steps.findIndex((s) => s.pack === p.packNumber && s.pick === p.pickNumber);
        return idx < stepIndex;
      })
      .map((p) => p.oracle_id);
  }, [draftSeatPicks, seatIndex, steps, stepIndex]);

  const availableOracles = useMemo(
    () => cards.filter((c) => !c.wasTrashed && c.pickedAtPick >= currentStep.pick).map((c) => c.oracle_id),
    [cards, currentStep.pick],
  );

  useEffect(() => {
    if (availableOracles.length === 0) { setMlLoading(false); return; }
    let cancelled = false;
    setMlLoading(true);
    setMlScores(null);
    (async () => {
      try {
        await loadDraftBot();
        const remapping = buildOracleRemapping(cardMeta);
        const [ranked] = await localBatchDraftRanked([{ pack: availableOracles, pool: seatPool }], remapping);
        if (!cancelled && ranked) {
          const pcts = softmaxPcts(ranked.map((c) => c.rating));
          const scoreMap = new Map<string, MlScore>();
          ranked.forEach((card, idx) => scoreMap.set(card.oracle, { rank: idx + 1, pct: pcts[idx] ?? 0 }));
          setMlScores(scoreMap);
        }
      } catch {
        // graceful degradation
      } finally {
        if (!cancelled) setMlLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [availableOracles, seatPool, cardMeta]);

  const cardImg = (oracle: string) => cardMeta[oracle]?.imageUrl ?? `/tool/cardimage/${encodeURIComponent(oracle)}`;
  const cardName = (oracle: string) => cardMeta[oracle]?.name ?? oracle;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#141619', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 60px rgba(0,0,0,0.8)', maxWidth: 900, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'packFadeIn 0.22s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Seat {seatIndex + 1}</span>
              {archetypeName && <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}>— {archetypeName}</span>}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>Pack {currentStep.pack + 1} · Pick {currentStep.pick}</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>
              ★ picked · faded = already taken · % = ML bot preference · ← → to navigate
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mlLoading && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>Computing…</span>}
            <button type="button" onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '4px 9px' }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {cards.map((card) => {
              const alreadyTaken = card.wasTrashed || card.pickedAtPick < currentStep.pick;
              const ml = mlScores?.get(card.oracle_id);
              const isTopMl = ml?.rank === 1;
              return (
                <div key={`${card.oracle_id}-${card.pickedAtPick}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: PACK_CARD_W }}>
                  <div style={{ position: 'relative' }}>
                    <img src={cardImg(card.oracle_id)} alt={cardName(card.oracle_id)} title={cardName(card.oracle_id)}
                      style={{ width: PACK_CARD_W, height: PACK_CARD_H, borderRadius: 5, objectFit: 'cover', opacity: alreadyTaken ? 0.28 : 1, border: card.isThisPick ? '2px solid #f5c842' : alreadyTaken ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.1)', boxShadow: card.isThisPick ? '0 0 10px #f5c84255' : undefined }} />
                    {card.isThisPick && (
                      <div style={{ position: 'absolute', top: -6, right: -6, background: '#f5c842', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#000' }}>★</div>
                    )}
                    {/* ML score badge */}
                    {ml && !alreadyTaken && (
                      <div style={{
                        position: 'absolute', bottom: 4, left: 0, right: 0,
                        display: 'flex', justifyContent: 'center',
                      }}>
                        <div style={{
                          background: isTopMl ? 'rgba(22,163,74,0.92)' : ml.rank <= 3 ? 'rgba(29,78,216,0.88)' : 'rgba(0,0,0,0.72)',
                          borderRadius: 4, padding: '2px 6px',
                          fontSize: 11, fontWeight: 700,
                          color: '#fff',
                          lineHeight: 1.4,
                          backdropFilter: 'blur(2px)',
                        }}>
                          {ml.pct >= 1 ? `${ml.pct.toFixed(1)}%` : `${ml.pct.toFixed(2)}%`}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: card.isThisPick ? '#f5c842' : alreadyTaken ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.3, maxWidth: PACK_CARD_W, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.isThisPick
                      ? ml ? `★ Picked · ${ml.pct >= 1 ? ml.pct.toFixed(1) : ml.pct.toFixed(2)}% · #${ml.rank}` : '★ Picked'
                      : card.wasTrashed
                        ? `Trash·P${card.pickedAtPick}`
                        : alreadyTaken
                        ? `S${(card.pickedBy ?? 0) + 1}·P${card.pickedAtPick}`
                        : card.pickedBy !== null
                          ? `→ S${card.pickedBy + 1}·P${card.pickedAtPick}`
                          : ''}
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
  archetypeName: string | null;
  stepIndex: number;
  currentStep: Step;
  cardMeta: Record<string, CardMeta>;
  onOpenPack: () => void;
  onOpenPile: () => void;
  isPackOpen: boolean;
  isPileOpen: boolean;
  anyOpen: boolean;
}> = ({ seatIndex, state, archetypeName, stepIndex, currentStep, cardMeta, onOpenPack, onOpenPile, isPackOpen, isPileOpen, anyOpen }) => {
  const colorCodes = archetypeColorCodes(state.archetype);
  const accentColor = MTG_COLORS[colorCodes[0]]?.bg ?? '#6b7280';
  const currentOracle = state.currentPick;
  const recentPrev = state.prevPicks.slice(-14).reverse();
  const pickCount = state.prevPicks.length + (currentOracle ? 1 : 0);
  const isActive = isPackOpen || isPileOpen;

  const cardImg = (oracle: string) => cardMeta[oracle]?.imageUrl ?? `/tool/cardimage/${encodeURIComponent(oracle)}`;
  const cardName = (oracle: string) => cardMeta[oracle]?.name ?? oracle;

  const dimmed = anyOpen && !isActive;

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
      {/* Current pick card — click to open pack */}
      <div
        style={{ flexShrink: 0, padding: '6px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: currentOracle ? 'pointer' : 'default' }}
        onClick={(e) => { e.stopPropagation(); if (currentOracle) onOpenPack(); }}
        title={currentOracle ? 'Click to view pack + ML scores' : undefined}
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
        <div style={{ padding: '7px 8px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)', flexShrink: 0 }}>
              Seat {seatIndex + 1}
            </span>
            {archetypeName && (
              <span style={{ fontSize: 10, fontWeight: 500, color: accentColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {archetypeName}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {pickCount > 0 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', fontVariantNumeric: 'tabular-nums' }}>{pickCount}</span>
            )}
            {colorCodes.map((c) => (
              <span key={c} title={c} style={{ width: 8, height: 8, borderRadius: '50%', background: MTG_COLORS[c]?.bg ?? '#888', display: 'inline-block', flexShrink: 0 }} />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: '5px 6px 5px', display: 'flex', flexWrap: 'wrap', gap: 2, alignContent: 'flex-start', overflow: 'hidden' }}>
          {recentPrev.map((oracle, idx) => (
            <img key={`${oracle}-${idx}`} src={cardImg(oracle)} alt="" title={cardName(oracle)} loading="lazy"
              style={{ width: THUMB_W, height: THUMB_H, borderRadius: 2, objectFit: 'cover', opacity: 0.7, border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface DraftTableViewProps {
  runData: SimulationRunData;
  slimPools: SlimPool[];
  cardMeta: Record<string, CardMeta>;
  numDrafts: number;
  numSeats: number;
  poolArchetypeLabels?: Map<number, string> | null;
}

const DraftTableView: React.FC<DraftTableViewProps> = ({ runData, slimPools, cardMeta, numDrafts, numSeats, poolArchetypeLabels }) => {
  const [draftIndex, setDraftIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  // Track which seat's pack is open — derives pack/pick from currentStep so it live-updates with keyboard nav
  const [packViewSeat, setPackViewSeat] = useState<number | null>(null);
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

  const seatArchetypeNames = useMemo(() => {
    if (!poolArchetypeLabels) return new Map<number, string>();
    const map = new Map<number, string>();
    slimPools.forEach((pool, poolIdx) => {
      if (pool.draftIndex !== draftIndex) return;
      const name = poolArchetypeLabels.get(poolIdx);
      if (name) map.set(pool.seatIndex, name);
    });
    return map;
  }, [slimPools, draftIndex, poolArchetypeLabels]);

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

  // Keyboard navigation — left/right arrows step through picks
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
      if (e.key === 'Escape') { setPackViewSeat(null); setPileViewSeat(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nudge]);

  useEffect(() => { setStepIndex(0); setIsPlaying(false); setPackViewSeat(null); setPileViewSeat(null); }, [draftIndex]);

  const draftOptions = useMemo(
    () => Array.from({ length: numDrafts }, (_, i) => ({ value: String(i), label: `Draft ${i + 1}` })),
    [numDrafts],
  );

  const leftCount = Math.ceil(numSeats / 2);
  const leftSeats = Array.from({ length: leftCount }, (_, i) => i);
  const rightSeats = Array.from({ length: numSeats - leftCount }, (_, i) => leftCount + i);

  const anyOpen = packViewSeat !== null || pileViewSeat !== null;

  const renderSeat = (seat: number) => {
    const state = seatStates.get(seat);
    if (!state) return null;
    return (
      <SeatPanel
        key={seat}
        seatIndex={seat}
        state={state}
        archetypeName={seatArchetypeNames.get(seat) ?? null}
        stepIndex={stepIndex}
        currentStep={currentStep}
        cardMeta={cardMeta}
        onOpenPack={() => setPackViewSeat(seat)}
        onOpenPile={() => setPileViewSeat(seat)}
        isPackOpen={packViewSeat === seat}
        isPileOpen={pileViewSeat === seat}
        anyOpen={anyOpen}
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
          archetypeName={seatArchetypeNames.get(pileViewSeat) ?? null}
          draftSeatPicks={draftSeatPicks}
          steps={steps}
          stepIndex={stepIndex}
          cardMeta={cardMeta}
          onClose={() => setPileViewSeat(null)}
        />
      )}

      {packViewSeat !== null && (
        <PackOverlay
          draftIndex={draftIndex}
          seatIndex={packViewSeat}
          runData={runData}
          currentStep={currentStep}
          draftSeatPicks={draftSeatPicks}
          steps={steps}
          stepIndex={stepIndex}
          numSeats={numSeats}
          packSize={packSize}
          cardMeta={cardMeta}
          archetypeName={seatArchetypeNames.get(packViewSeat) ?? null}
          onClose={() => setPackViewSeat(null)}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap py-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={String(draftIndex)} onChange={(e) => setDraftIndex(Number(e.target.value))}
            className="rounded border border-border bg-bg text-sm px-2 py-1 text-text">
            {draftOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="flex">
            <button type="button" onClick={() => nudge(-1)} disabled={stepIndex === 0}
              className="px-2 py-1 text-base rounded-l border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none">‹</button>
            <button type="button"
              onClick={() => { if (stepIndex >= maxStep) setStepIndex(0); setIsPlaying((p) => !p); }}
              className="px-3 py-1 text-sm -ml-px border border-border bg-bg hover:bg-bg-active text-text min-w-[72px] text-center">
              {isPlaying ? '⏸ Pause' : stepIndex >= maxStep ? '↺ Replay' : '▶ Play'}
            </button>
            <button type="button" onClick={() => nudge(1)} disabled={stepIndex >= maxStep}
              className="px-2 py-1 text-base rounded-r -ml-px border border-border bg-bg hover:bg-bg-active disabled:opacity-30 text-text leading-none">›</button>
          </div>

          <div className="flex">
            {SPEEDS.map((s, i) => (
              <button key={s.label} type="button" onClick={() => setSpeedIndex(i)}
                className={[
                  'px-2.5 py-1 text-xs font-medium border',
                  i === 0 ? 'rounded-l' : i === SPEEDS.length - 1 ? 'rounded-r -ml-px' : '-ml-px',
                  speedIndex === i ? 'border-link text-link bg-link/10 relative z-10' : 'border-border text-text-secondary bg-bg hover:bg-bg-active hover:text-text',
                ].join(' ')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input type="range" min={0} max={maxStep} value={stepIndex}
            onChange={(e) => { setIsPlaying(false); setStepIndex(Number(e.target.value)); }}
            className="w-44 accent-link" />
          <span className="text-xs text-text-secondary whitespace-nowrap tabular-nums font-mono">
            P{currentStep.pack + 1}·P{currentStep.pick} {stepIndex + 1}/{steps.length}
          </span>
        </div>
      </div>

      {/* ── Table layout ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {leftSeats.map(renderSeat)}
        </div>

        <div className="flex-shrink-0 flex flex-col items-center justify-center" style={{ minWidth: 118 }}>
          <div style={{ background: '#182b1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '18px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase' }}>Pack {currentStep.pack + 1}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {currentStep.pick}
              {packSize > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>of {packSize}</span>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 5 }}>
              {passesLeft && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>←</span>}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500, letterSpacing: 0.3 }}>{passesLeft ? 'Passing left' : 'Passing right'}</span>
              {!passesLeft && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>→</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {rightSeats.map(renderSeat)}
        </div>
      </div>

      <div className="text-xs text-text-secondary">
        Draft {draftIndex + 1} of {numDrafts} · {numSeats} seats · {steps.length} picks · ← → to step through picks · click card for pack + ML · click seat for pick pile
      </div>
    </div>
  );
};

export default DraftTableView;
