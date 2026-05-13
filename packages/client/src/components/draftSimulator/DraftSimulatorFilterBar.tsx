import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { ArchetypeEntry, ArchetypeSkeleton, CardStats } from '@utils/datatypes/SimulationReport';

import Text from '../base/Text';

type FilterChipItem = {
  key: string;
  label: string;
  detail?: string;
  onClear: () => void;
};

const CardFilterInput: React.FC<{
  cardStats: CardStats[];
  selectedCardOracles: string[];
  onAddCard: (oracleId: string) => void;
}> = ({ cardStats, selectedCardOracles, onAddCard }) => {
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.trim().toLowerCase();
    return cardStats.filter((card) => card.name.toLowerCase().includes(q)).slice(0, 10);
  }, [value, cardStats]);

  const accept = (card: CardStats) => {
    onAddCard(card.oracle_id);
    setValue('');
    setVisible(false);
    setPosition(-1);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = visible && suggestions.length > 0;
  const disabled = selectedCardOracles.length >= 2;

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          setVisible(true);
          setPosition(-1);
        }}
        onFocus={() => {
          if (value) setVisible(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setPosition((p) => Math.min(p + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setPosition((p) => Math.max(p - 1, -1));
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (showDropdown) {
              const idx = position >= 0 ? position : 0;
              const card = suggestions[idx];
              if (card) {
                e.preventDefault();
                accept(card);
              }
            }
          } else if (e.key === 'Escape') {
            setVisible(false);
          }
        }}
        placeholder={disabled ? 'Max 2 cards' : 'Search cards in this cube…'}
        className="w-full rounded border border-border bg-bg px-2 py-1 text-sm text-text disabled:opacity-50"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 mt-0.5 w-full rounded-md border border-border flex flex-col z-[1050]">
          {suggestions.map((card, idx) => (
            <div
              key={card.oracle_id}
              onMouseDown={(e) => {
                e.preventDefault();
                accept(card);
              }}
              className={[
                'px-2 py-1.5 cursor-pointer text-sm',
                idx === 0 ? 'rounded-t-md' : 'border-t border-border',
                idx === suggestions.length - 1 ? 'rounded-b-md' : '',
                idx === position ? 'bg-bg-active' : 'bg-bg-accent hover:bg-bg-active',
              ].join(' ')}
            >
              {card.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DraftSimulatorFilterBar: React.FC<{
  chips: FilterChipItem[];
  matchingPools: number;
  totalPools: number;
  cardStats: CardStats[];
  selectedCardOracles: string[];
  archetypeDistribution: ArchetypeEntry[];
  selectedArchetype: string | null;
  skeletons: ArchetypeSkeleton[];
  selectedSkeletonId: number | null;
  onAddCard: (oracleId: string) => void;
  onAddDeckCard: (oracleId: string) => void;
  onSelectArchetype: (archetype: string | null) => void;
  onSelectSkeleton: (clusterId: number | null) => void;
  onClearAll: () => void;
  renderArchetypeLabel: (colorPair: string) => string;
  renderSkeletonLabel: (skeleton: ArchetypeSkeleton) => string;
}> = ({
  chips,
  matchingPools,
  totalPools,
  cardStats,
  selectedCardOracles,
  archetypeDistribution,
  selectedArchetype,
  skeletons,
  selectedSkeletonId,
  onAddCard,
  onAddDeckCard,
  onSelectArchetype,
  onSelectSkeleton,
  onClearAll,
  renderArchetypeLabel,
  renderSkeletonLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cardFilterMode, setCardFilterMode] = useState<'pool' | 'deck'>('deck');
  const hasFilters = chips.length > 0;
  const topColorProfiles = archetypeDistribution.slice(0, 8);
  const topSkeletons = skeletons.slice(0, 8);

  return (
    <div className="md:sticky md:top-2 md:z-20 rounded-lg border border-border bg-bg shadow-md">
      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Text semibold className="text-lg">
              Active Filters
            </Text>
            <span className="rounded bg-bg-accent px-2.5 py-1 text-xs text-text-secondary">
              {matchingPools}/{totalPools} seats
            </span>
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2.5">
            {hasFilters ? (
              chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex max-w-full items-center gap-1.5 rounded border border-link/30 bg-link/10 px-3 py-1.5 text-sm font-semibold text-link hover:bg-link/20"
                  title={`Clear ${chip.label}`}
                >
                  {chip.detail && <span className="font-medium opacity-70">{chip.detail}</span>}
                  <span className="truncate">{chip.label}</span>
                  <span className="opacity-60">×</span>
                </button>
              ))
            ) : (
              <Text xs className="text-text-secondary">
                No active filters. Click a card, color profile, cluster, or map point to narrow the run.
              </Text>
            )}
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded border border-border bg-bg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-active"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="rounded border border-border bg-bg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-active"
          >
            {isOpen ? 'Hide filters' : 'Edit filters'}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="grid gap-5 border-t border-border px-5 py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Text xs className="mb-1.5 font-medium uppercase tracking-[0.14em] text-text-secondary/70">
              Cards
            </Text>
            <CardFilterInput
              cardStats={cardStats}
              selectedCardOracles={selectedCardOracles}
              onAddCard={cardFilterMode === 'deck' ? onAddDeckCard : onAddCard}
            />
            <div className="mt-1.5 flex items-center gap-3">
              {(['deck', 'pool'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer select-none">
                  <input
                    type="radio"
                    name="cardFilterMode"
                    value={mode}
                    checked={cardFilterMode === mode}
                    onChange={() => setCardFilterMode(mode)}
                    className="accent-link"
                  />
                  {mode === 'deck' ? 'In deck' : 'In pool'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Text xs className="mb-1.5 font-medium uppercase tracking-[0.14em] text-text-secondary/70">
              Color
            </Text>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectArchetype(null)}
                className={[
                  'rounded border px-2 py-1 text-xs font-medium',
                  selectedArchetype === null
                    ? 'border-link bg-link/10 text-link'
                    : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                ].join(' ')}
              >
                Any
              </button>
              {topColorProfiles.map((entry) => (
                <button
                  key={entry.colorPair}
                  type="button"
                  onClick={() => onSelectArchetype(selectedArchetype === entry.colorPair ? null : entry.colorPair)}
                  className={[
                    'rounded border px-2 py-1 text-xs font-medium',
                    selectedArchetype === entry.colorPair
                      ? 'border-link bg-link/10 text-link'
                      : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                  ].join(' ')}
                >
                  {renderArchetypeLabel(entry.colorPair)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Text xs className="mb-1.5 font-medium uppercase tracking-[0.14em] text-text-secondary/70">
              Cluster
            </Text>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectSkeleton(null)}
                className={[
                  'rounded border px-2 py-1 text-xs font-medium',
                  selectedSkeletonId === null
                    ? 'border-link bg-link/10 text-link'
                    : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                ].join(' ')}
              >
                Any
              </button>
              {topSkeletons.map((skeleton) => (
                <button
                  key={skeleton.clusterId}
                  type="button"
                  onClick={() => onSelectSkeleton(selectedSkeletonId === skeleton.clusterId ? null : skeleton.clusterId)}
                  className={[
                    'rounded border px-2 py-1 text-xs font-medium',
                    selectedSkeletonId === skeleton.clusterId
                      ? 'border-link bg-link/10 text-link'
                      : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                  ].join(' ')}
                >
                  {renderSkeletonLabel(skeleton)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export type { FilterChipItem };
export default DraftSimulatorFilterBar;
