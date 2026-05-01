/* eslint-disable camelcase */
import React, { useEffect, useRef, useState } from 'react';

import type {
  BuiltDeck,
  CardMeta,
  SimulatedPickCard,
  SimulatedPool,
  SimulationRunData,
} from '@utils/datatypes/SimulationReport';

import { Modal, ModalBody, ModalHeader } from '../base/Modal';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import SimDeckView from './SimDeckView';
import SimulatorPickBreakdown, { PickCard } from './SimulatorPickBreakdown';

type PoolViewMode = 'pool' | 'deck' | 'fullPickOrder';

export const ViewToggle: React.FC<{
  mode: PoolViewMode;
  onChange: (m: PoolViewMode) => void;
  hasDeck: boolean;
  hasFullPickOrder: boolean;
  deckLoading?: boolean;
}> = ({ mode, onChange, hasDeck, hasFullPickOrder, deckLoading }) => (
  <Flexbox direction="row" gap="1" className="rounded-lg border border-border/70 bg-bg-accent/50 p-1">
    {(['deck', 'pool', 'fullPickOrder'] as const).map((m) => (
      <button
        key={m}
        type="button"
        disabled={(m === 'deck' && !hasDeck) || (m === 'fullPickOrder' && !hasFullPickOrder)}
        onClick={() => onChange(m)}
        className={[
          'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          mode === m
            ? 'bg-link text-white shadow-sm'
            : 'bg-transparent text-text-secondary hover:bg-bg-active hover:text-text',
          (m === 'deck' && !hasDeck) || (m === 'fullPickOrder' && !hasFullPickOrder)
            ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-text-secondary'
            : '',
        ].join(' ')}
      >
        {m === 'deck' ? (deckLoading ? 'Building…' : 'Deck') : m === 'pool' ? 'Pick Order' : 'Full pick order'}
      </button>
    ))}
  </Flexbox>
);

export const PoolExpansionContent: React.FC<{
  pool: SimulatedPool;
  mode: PoolViewMode;
  deck: BuiltDeck | null;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  highlightOracle?: string;
}> = ({ pool, mode, deck, cardMeta, runData, highlightOracle }) => {
  if (mode === 'deck' && deck && (deck.mainboard.length > 0 || deck.sideboard.length > 0)) {
    return <SimDeckView deck={deck} cardMeta={cardMeta} />;
  }
  if (mode === 'fullPickOrder') {
    return <SimulatorPickBreakdown pool={pool} runData={runData} />;
  }
  const orderedPicks = [...pool.picks].sort((a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber);
  return (
    <div className="p-3 overflow-x-auto">
      <Flexbox direction="col" gap="2">
        {[0, 1, 2].map((packNum) => {
          const packPicks = orderedPicks.filter((p) => p.packNumber === packNum);
          if (packPicks.length === 0) return null;
          return (
            <div key={packNum}>
              <Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">
                Pack {packNum + 1}
              </Text>
              <div className="flex flex-row gap-1.5 flex-wrap">
                {packPicks.map((pick) => (
                  <PickCard
                    key={`${pick.packNumber}-${pick.pickNumber}`}
                    pick={pick}
                    isSelected={pick.oracle_id === highlightOracle}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </Flexbox>
    </div>
  );
};

export const PoolInspectionModal: React.FC<{
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  pool: SimulatedPool | null;
  deck: BuiltDeck | null;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  themes: string[];
  archetypeLabel?: string | null;
  highlightOracle?: string;
  deckLoading?: boolean;
  themeBreakdown?: { bucket: string; cards: { name: string; rawTags: string[] }[] }[];
}> = ({
  isOpen,
  setOpen,
  pool,
  deck,
  cardMeta,
  runData,
  themes,
  archetypeLabel,
  highlightOracle,
  deckLoading,
  themeBreakdown,
}) => {
  // Keep last opened pool around so the leave transition has data to render against.
  const lastPoolRef = useRef<{
    pool: SimulatedPool;
    deck: BuiltDeck | null;
    themes: string[];
    archetypeLabel: string | null | undefined;
    themeBreakdown: typeof themeBreakdown;
  } | null>(null);
  if (pool) {
    lastPoolRef.current = { pool, deck, themes, archetypeLabel, themeBreakdown };
  }
  const snapshot = pool
    ? { pool, deck, themes, archetypeLabel, themeBreakdown }
    : lastPoolRef.current;

  const renderPool = snapshot?.pool ?? null;
  const renderDeck = snapshot?.deck ?? null;
  const renderThemes = snapshot?.themes ?? [];
  const renderArchetypeLabel = snapshot?.archetypeLabel ?? null;
  const renderThemeBreakdown = snapshot?.themeBreakdown;

  const hasDeck = !!renderDeck && (renderDeck.mainboard.length > 0 || renderDeck.sideboard.length > 0);
  const hasFullPickOrder = !!runData.setupData;

  const [viewMode, setViewMode] = useState<PoolViewMode>('deck');
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Reset internal state each time the modal opens for a new pool.
  useEffect(() => {
    if (!isOpen) return;
    setViewMode(hasDeck ? 'deck' : hasFullPickOrder ? 'fullPickOrder' : 'pool');
    setBreakdownOpen(false);
  }, [isOpen, renderPool?.poolIndex, hasDeck, hasFullPickOrder]);

  if (!renderPool) return null;

  return (
    <Modal
      xxl
      scrollable
      isOpen={isOpen}
      setOpen={setOpen}
      offsetClassName="pt-4 md:pt-8"
      backdropClassName="bg-opacity-60 backdrop-blur-[2px]"
      panelClassName="rounded-xl border-border/70 bg-bg shadow-2xl"
    >
      <ModalHeader setOpen={setOpen} className="!bg-transparent !px-5 !py-4 border-b border-border/70">
        <Flexbox direction="col" gap="1" className="min-w-0 flex-1">
          <Text semibold lg>
            Draft {renderPool.draftIndex + 1} · Seat {renderPool.seatIndex + 1}
          </Text>
          {(renderArchetypeLabel || renderPool.archetype) && (
            <span className="text-sm font-medium">
              {renderPool.archetype && renderPool.archetype !== 'C' && (
                <span className="text-text-secondary mr-1">{renderPool.archetype}</span>
              )}
              {renderArchetypeLabel && <span className="text-link">{renderArchetypeLabel}</span>}
            </span>
          )}
          {renderThemes.length > 0 && (
            <Text xs className="text-text-secondary">{renderThemes.join(', ')}</Text>
          )}
          {renderThemeBreakdown && renderThemeBreakdown.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setBreakdownOpen((o) => !o)}
                className="self-start mt-1 inline-flex items-center rounded-md border border-border/70 bg-bg-accent/50 px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-active hover:text-text transition-colors whitespace-nowrap"
              >
                {breakdownOpen ? '▾ Hide' : '▸ Show'} breakdown
              </button>
              {breakdownOpen && (
                <div className="mt-2 rounded-lg border border-border/70 bg-bg-accent/35 px-3 py-2 text-[10px] font-mono leading-tight max-h-40 overflow-y-auto">
                  {renderThemeBreakdown.map(({ bucket, cards }) => (
                    <div key={bucket} className="mb-1.5">
                      <span className="font-bold text-link">{bucket} ({cards.length})</span>
                      <div className="ml-2">
                        {cards.map(({ name, rawTags }) => (
                          <div key={name} className="text-text-secondary">
                            {name}{' '}
                            <span className="opacity-50">[{rawTags.join(', ')}]</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Flexbox>
      </ModalHeader>
      <ModalBody scrollable className="!p-0 !border-y-0 bg-bg">
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-border/70 bg-bg/95 backdrop-blur sticky top-0 z-10">
          <ViewToggle
            mode={viewMode}
            onChange={setViewMode}
            hasDeck={hasDeck}
            hasFullPickOrder={hasFullPickOrder}
            deckLoading={deckLoading}
          />
        </div>
        <PoolExpansionContent
          pool={renderPool}
          mode={viewMode}
          deck={renderDeck}
          cardMeta={cardMeta}
          runData={runData}
          highlightOracle={highlightOracle}
        />
      </ModalBody>
    </Modal>
  );
};

export default PoolInspectionModal;
