import type {
  ArchetypeSkeleton,
  BuiltDeck,
  CardStats,
  LockPair,
  SimulatedPool,
  SimulationRunData,
  SimulationSetupResponse,
  SkeletonCard,
} from '@utils/datatypes/SimulationReport';

export type DraftSimulatorBottomTab =
  | 'archetypes'
  | 'deckColor'
  | 'cardStats'
  | 'draftBreakdown'
  | 'overperformers'
  | 'sideboardAndPairings';

export type DraftSimulatorPoolViewMode = 'pool' | 'deck' | 'fullPickOrder';

export interface DraftSimulatorDerivedData {
  displayRunData: SimulationRunData | null;
  currentRunSetup: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'> | null;
  displayedPools: SimulatedPool[];
  activeDecks: BuiltDeck[] | null;
  skeletons: ArchetypeSkeleton[];
  poolArchetypeLabels: Map<number, string> | null;
  skeletonColorProfiles: Map<number, string>;
}

export interface DraftSimulatorSelectionState {
  selectedCardOracles: string[];
  selectedSkeletonId: number | null;
  selectedArchetype: string | null;
  focusedPoolIndex: number | null;
  focusedPoolViewMode: DraftSimulatorPoolViewMode;
}

export interface DraftSimulatorSelectionSetters {
  setSelectedCardOracles: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedArchetype: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedSkeletonId: React.Dispatch<React.SetStateAction<number | null>>;
  setFocusedPoolIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

export interface DraftSimulatorFilterPreview {
  commonCards: SkeletonCard[];
  supportCards: SkeletonCard[];
  sideboardCards: SkeletonCard[];
  lockPairs: LockPair[];
}

