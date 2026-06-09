import React from 'react';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

export type SimulationPhase = 'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'cluster' | 'save' | null;

// Maps the current phase (+ sub-progress) to an overall 0–100. Shared so every ML
// pipeline shows the same monotonic progression, not its own ad-hoc scale.
export function getOverallSimProgress(
  simPhase: SimulationPhase,
  modelLoadProgress: number,
  simProgress: number,
): number {
  switch (simPhase) {
    case 'setup':
      return 5;
    case 'loadmodel':
      return 5 + Math.round((modelLoadProgress / 100) * 15);
    case 'sim':
      return 20 + Math.round((simProgress / 100) * 70);
    case 'deckbuild':
      return 92;
    case 'cluster':
      return 96;
    case 'save':
      return 98;
    default:
      return 0;
  }
}

const PHASE_LABELS: Record<Exclude<SimulationPhase, null>, string> = {
  setup: 'Preparing packs…',
  loadmodel: 'Loading draft model…',
  sim: 'Running draft simulation…',
  deckbuild: 'Building decks…',
  cluster: 'Clustering decks…',
  save: 'Storing results locally…',
};

interface SimulationProgressBarProps {
  phase: SimulationPhase;
  overallProgress: number;
  // Optional override for the phase label (e.g. "Resolving cards…" during setup).
  label?: string;
}

// The exact progress bar used by the draft simulator, extracted so other ML
// pipelines (e.g. the record/Hedron deckbuild) render an identical loading bar
// instead of a one-off. Green fill, pulses on every phase except the live `sim`.
const SimulationProgressBar: React.FC<SimulationProgressBarProps> = ({ phase, overallProgress, label }) => (
  <Flexbox direction="col" gap="2">
    <Flexbox direction="row" justify="between">
      <Text sm>{label ?? (phase ? PHASE_LABELS[phase] : '')}</Text>
      <Text sm className="text-text-secondary">
        {overallProgress}%
      </Text>
    </Flexbox>
    <div className="w-full bg-bg rounded-full h-2.5 overflow-hidden">
      <div
        className={[
          'h-2.5 rounded-full bg-green-600 transition-all duration-500',
          phase !== 'sim' ? 'animate-pulse' : '',
        ].join(' ')}
        style={{ width: `${Math.max(2, overallProgress)}%`, opacity: phase === 'sim' ? 1 : 0.8 }}
      />
    </div>
  </Flexbox>
);

export default SimulationProgressBar;
