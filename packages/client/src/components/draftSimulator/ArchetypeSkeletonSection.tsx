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

    return (
    <div
      key={skeleton.clusterId}
      className={[
        'bg-bg px-3 py-3',
        selectedSkeletonId === skeleton.clusterId ? 'bg-link/5' : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="flex w-full flex-col gap-2 rounded-md px-2 py-2 text-left hover:bg-bg-active"
        onClick={() => onSelectSkeleton(selectedSkeletonId === skeleton.clusterId ? null : skeleton.clusterId)}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">Cluster {skIdx + 1}</div>
            <div className="mt-0.5 font-semibold tracking-tight text-sm sm:text-base">
              {dominantArchetype ? (
                `${skeletonColorProfiles.get(skeleton.clusterId) && skeletonColorProfiles.get(skeleton.clusterId) !== 'C' ? `${skeletonColorProfiles.get(skeleton.clusterId)} ` : ''}${dominantArchetype}`
              ) : poolArchetypeLabelsLoading ? (
                <span className="inline-block h-4 w-28 animate-pulse rounded bg-bg-accent align-middle" />
              ) : (
                getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles)
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span>{skeleton.poolCount} seats</span>
            <span>{((skeleton.poolCount / totalPools) * 100).toFixed(1)}%</span>
            {selectedSkeletonId === skeleton.clusterId && (
              <span className="inline-flex w-fit bg-link/20 text-link border border-link/30 rounded px-2 py-0.5">
                Filtering
              </span>
            )}
          </div>
        </div>
        {clusterThemesByClusterId?.get(skeleton.clusterId)?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {clusterThemesByClusterId.get(skeleton.clusterId)!.map((theme) => (
              <span
                key={theme}
                className="inline-flex w-fit text-[10px] bg-bg-accent border border-border/60 rounded px-1.5 py-0.5 text-text-secondary"
              >
                {theme}
              </span>
            ))}
          </div>
        ) : null}
        {(() => {
          // Legacy cached skeletons may hold a flat SkeletonCard[] for coreCards
          // before the RankedCards shape landed. Tolerate it until rescore fires.
          const ranked = skeleton.coreCards as unknown as RankedCards | SkeletonCard[];
          const archetypeCards = Array.isArray(ranked)
            ? ranked
            : excludeManaFixingLands
              ? ranked.excludingFixing
              : ranked.default;
          return archetypeCards.length > 0 ? (
            <div className="min-w-0 flex flex-row flex-wrap gap-1.5 pt-1">
              {archetypeCards.slice(0, 8).map((card) => (
                <SkeletonCardImage key={card.oracle_id} card={card} size={120} onCardClick={() => {}} />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border/70 bg-bg-accent/30 px-3 py-2">
              <Text sm className="text-text-secondary">
                No shared cards were found for this cluster.
              </Text>
            </div>
          );
        })()}
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
