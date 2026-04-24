import React from 'react';

import type { ArchetypeEntry } from '@utils/datatypes/SimulationReport';

import { archetypeFullName } from '../../utils/draftSimulatorThemes';

const MTG_COLORS: Record<string, { bg: string }> = {
  W: { bg: '#D8CEAB' },
  U: { bg: '#67A6D3' },
  B: { bg: '#8C7A91' },
  R: { bg: '#D85F69' },
  G: { bg: '#6AB572' },
  C: { bg: '#ADADAD' },
  M: { bg: '#DBC467' },
};

function getColorProfileCodes(colorPair: string): string[] {
  const letters = colorPair.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return letters.length === 0 ? ['C'] : letters;
}

function getColorProfileGradient(colorPair: string): string {
  const colors = getColorProfileCodes(colorPair).map((code) => MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg);
  if (colors.length === 1) return colors[0]!;
  const stopStep = colors.length > 1 ? 100 / (colors.length - 1) : 100;
  const stops = colors.map((color, index) => `${color} ${Math.round(index * stopStep)}%`).join(', ');
  return `linear-gradient(90deg, ${stops})`;
}

const ArchetypeChart: React.FC<{
  archetypeDistribution: ArchetypeEntry[];
  selectedArchetype: string | null;
  onSelect: (colorPair: string | null) => void;
  topArchetypesByColor?: Map<string, string[]>;
}> = ({ archetypeDistribution, selectedArchetype, onSelect, topArchetypesByColor }) => {
  const maxCount = Math.max(...archetypeDistribution.map((entry) => entry.count), 1);

  return (
    <div className="flex flex-col gap-2">
      {archetypeDistribution.map((entry) => {
        const colorCodes = getColorProfileCodes(entry.colorPair);
        const isSelected = entry.colorPair === selectedArchetype;
        const pct = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;

        return (
          <button
            key={entry.colorPair}
            type="button"
            onClick={() => onSelect(isSelected ? null : entry.colorPair)}
            className={[
              'w-full text-left rounded border transition-all',
              'px-3 py-3',
              isSelected
                ? 'border-link-active ring-1 ring-link-active bg-bg-active'
                : 'border-transparent hover:border-border hover:bg-bg-accent',
            ].join(' ')}
            style={isSelected ? { boxShadow: 'inset 0 0 0 1px rgb(var(--link-active) / 0.08)' } : undefined}
          >
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1 flex-shrink-0">
                  {colorCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-block rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        background: MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg,
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold truncate">{archetypeFullName(entry.colorPair)}</span>
              </div>
              <div className="flex items-baseline gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-text">{entry.count}</span>
                <span className="text-xs font-semibold text-text-secondary">{(entry.percentage * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 10, background: 'rgb(var(--bg-accent) / 1)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: getColorProfileGradient(entry.colorPair),
                }}
              />
            </div>
            {topArchetypesByColor?.get(entry.colorPair)?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {topArchetypesByColor.get(entry.colorPair)!.map((label) => (
                  <span key={label} className="text-xs text-text-secondary bg-bg-accent border border-border/60 rounded px-2 py-1">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default ArchetypeChart;
