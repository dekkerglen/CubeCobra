import React from 'react';

import type {
  ArchetypeSkeleton,
  RankedCards,
  SkeletonCard,
} from '@utils/datatypes/SimulationReport';

import { Card, CardBody, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import { SkeletonCardImage } from './ClusterDetailPanel';

function getSkeletonDisplayName(
  skeleton: ArchetypeSkeleton,
  poolArchetypeLabels: Map<number, string> | null | undefined,
  skeletonColorProfiles?: Map<number, string>,
): string {
  // Import archetypeFullName inline here
  const colorProfile = skeletonColorProfiles?.get(skeleton.clusterId) ?? skeleton.colorProfile;
  if (poolArchetypeLabels) {
    const counts = new Map<string, number>();
    for (const pi of skeleton.poolIndices) {
      const label = poolArchetypeLabels.get(pi);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      const colorPart = colorProfile && colorProfile !== 'C' ? `${colorProfile} ` : '';
      return `${colorPart}${dominant[0]}`;
    }
  }
  // Fallback: just color profile
  return colorProfile && colorProfile !== 'C' ? colorProfile : 'Colorless';
}

export const ArchetypeSkeletonSection: React.FC<{
  skeletons: ArchetypeSkeleton[];
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  clusterThemesByClusterId?: Map<number, string[]>;
  poolArchetypeLabels?: Map<number, string> | null;
  poolArchetypeLabelsLoading?: boolean;
  skeletonColorProfiles?: Map<number, string>;
  excludeManaFixingLands: boolean;
}> = ({ skeletons, totalPools, selectedSkeletonId, onSelectSkeleton, clusterThemesByClusterId, poolArchetypeLabels, poolArchetypeLabelsLoading, skeletonColorProfiles, excludeManaFixingLands }) => (
  <ArchetypeSkeletonSectionInner
    skeletons={skeletons}
    totalPools={totalPools}
    selectedSkeletonId={selectedSkeletonId}
    onSelectSkeleton={onSelectSkeleton}
    clusterThemesByClusterId={clusterThemesByClusterId}
    poolArchetypeLabels={poolArchetypeLabels}
    poolArchetypeLabelsLoading={poolArchetypeLabelsLoading}
    skeletonColorProfiles={skeletonColorProfiles}
    excludeManaFixingLands={excludeManaFixingLands}
  />
);

export const ArchetypeSkeletonSectionInner: React.FC<{
  skeletons: ArchetypeSkeleton[];
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  clusterThemesByClusterId?: Map<number, string[]>;
  poolArchetypeLabels?: Map<number, string> | null;
  poolArchetypeLabelsLoading?: boolean;
  skeletonColorProfiles?: Map<number, string>;
  excludeManaFixingLands: boolean;
}> = ({ skeletons, totalPools, selectedSkeletonId, onSelectSkeleton, clusterThemesByClusterId, poolArchetypeLabels, poolArchetypeLabelsLoading, skeletonColorProfiles = new Map(), excludeManaFixingLands }) => {

  const renderSkeleton = (skeleton: ArchetypeSkeleton, skIdx: number) => {
    // Compute dominant Gwen archetype label for this cluster
    const dominantArchetype = (() => {
      if (!poolArchetypeLabels) return null;
      const counts = new Map<string, number>();
      for (const pi of skeleton.poolIndices) {
        const label = poolArchetypeLabels.get(pi);
        if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      if (counts.size === 0) return null;
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    })();

    const ranked = skeleton.coreCards as unknown as RankedCards | SkeletonCard[];
    const archetypeCards = Array.isArray(ranked)
      ? ranked
      : excludeManaFixingLands
        ? ranked.excludingFixing
        : ranked.default;
    const displayName = dominantArchetype
      ? `${skeletonColorProfiles.get(skeleton.clusterId) && skeletonColorProfiles.get(skeleton.clusterId) !== 'C' ? `${skeletonColorProfiles.get(skeleton.clusterId)} ` : ''}${dominantArchetype}`
      : getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles);
    const themes = clusterThemesByClusterId?.get(skeleton.clusterId) ?? [];
    const isSelected = selectedSkeletonId === skeleton.clusterId;

    return (
      <div
        key={skeleton.clusterId}
        className={isSelected ? 'bg-link/5' : 'bg-bg'}
      >
        <button
          type="button"
          className="flex w-full flex-col gap-1.5 px-4 py-2.5 text-left hover:bg-bg-active transition-colors"
          onClick={() => onSelectSkeleton(isSelected ? null : skeleton.clusterId)}
        >
          {/* Title row: name + seats + filtering badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold tracking-tight text-sm">
              {poolArchetypeLabelsLoading && !dominantArchetype
                ? <span className="inline-block h-4 w-28 animate-pulse rounded bg-bg-accent align-middle" />
                : displayName}
            </span>
            <span className="text-[11px] text-text-secondary">
              {skeleton.poolCount} seats · {((skeleton.poolCount / totalPools) * 100).toFixed(1)}%
            </span>
            {isSelected && (
              <span className="inline-flex items-center bg-link/20 text-link border border-link/30 rounded px-1.5 py-0.5 text-[10px] font-medium">
                Filtering
              </span>
            )}
          </div>

          {/* Tags */}
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {themes.map((theme) => (
                <span
                  key={theme}
                  className="inline-flex text-[10px] bg-bg-accent border border-border/60 rounded px-1.5 py-0.5 text-text-secondary"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}

          {/* Card strip */}
          {archetypeCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-1.5 pt-0.5">
              {archetypeCards.slice(0, 10).map((card) => (
                <SkeletonCardImage key={card.oracle_id} card={card} onCardClick={() => {}} />
              ))}
            </div>
          ) : (
            <span className="text-xs text-text-secondary">No shared cards found.</span>
          )}
        </button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Text semibold>Archetypes</Text>
          </div>
          <Text xs className="text-text-secondary">
            Grouped by shared cards
          </Text>
        </div>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="3">
          <div className="overflow-hidden rounded-lg border border-border/80 divide-y divide-border/70">
            {skeletons.map((skeleton, idx) => renderSkeleton(skeleton, idx))}
          </div>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default ArchetypeSkeletonSection;
