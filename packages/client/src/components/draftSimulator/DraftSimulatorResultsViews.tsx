import React from 'react';

import type { BuiltDeck, CardMeta, CardStats, SimulationRunData } from '@utils/datatypes/SimulationReport';

import { Card, CardBody } from '../base/Card';
import Collapse from '../base/Collapse';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import {
  CardTypeShareChart,
  CardTypeShareLegend,
  DeckColorShareChart,
  DeckColorShareLegend,
  EloDistributionChart,
  ManaCurveShareChart,
} from './SimulatorCharts';

const OverviewChartSpinner: React.FC = () => (
  <div className="flex items-center justify-center" style={{ minHeight: 120 }}>
    <svg className="animate-spin h-6 w-6 text-text-secondary/40" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
);

const SummaryCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
}> = ({ label, value, sub }) => (
  <div className="flex-1 min-w-[180px]">
    <Card className="h-full">
      <CardBody className="text-center py-5">
        <div className="text-4xl font-bold mb-2">{value}</div>
        <div>
          <Text md semibold>
            {label}
          </Text>
        </div>
        {sub && (
          <div className="mt-1">
            <Text xs className="text-text-secondary">
              {sub}
            </Text>
          </div>
        )}
      </CardBody>
    </Card>
  </div>
);

export const DraftSimulatorOverviewSection: React.FC<{
  displayRunData: SimulationRunData;
  activeDecks: BuiltDeck[] | null;
  overviewOpen: boolean;
  setOverviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileLayout?: boolean;
}> = ({ displayRunData, activeDecks, overviewOpen, setOverviewOpen, mobileLayout = false }) => (
  <div className="simSection simSectionOverview flex flex-col gap-4">
    <div className="simSectionHeading flex items-center justify-between gap-3">
      <Text semibold className="tracking-wide">
        Simulation Overview
      </Text>
      <button
        type="button"
        onClick={() => setOverviewOpen((open) => !open)}
        className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
      >
        {overviewOpen ? '▲ Hide' : '▼ Show'}
      </button>
    </div>
    <Collapse isOpen={overviewOpen}>
      <Flexbox direction="row" gap="4" className="flex-col md:flex-row md:flex-wrap items-stretch">
        <div
          className={mobileLayout ? 'flex w-full flex-col gap-4' : 'flex flex-col gap-4 flex-shrink-0'}
          style={mobileLayout ? undefined : { width: 200 }}
        >
          <SummaryCard
            label="Drafts Simulated"
            value={displayRunData.numDrafts}
            sub={`${displayRunData.numSeats} seats each`}
          />
          <SummaryCard
            label="Cards Tracked"
            value={displayRunData.cardStats.length}
            sub="unique cards seen across all packs"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <Card className="h-full">
            <CardBody className="py-3">
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                Deck Color Share
              </Text>
              {!activeDecks ? (
                <OverviewChartSpinner />
              ) : mobileLayout ? (
                <DeckColorShareLegend deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
              ) : (
                <DeckColorShareChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
              )}
            </CardBody>
          </Card>
        </div>
        <div className="flex-1 min-w-[180px]">
          <Card className="h-full">
            <CardBody className="py-3">
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                Card Types
              </Text>
              {!activeDecks ? (
                <OverviewChartSpinner />
              ) : mobileLayout ? (
                <CardTypeShareLegend deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
              ) : (
                <CardTypeShareChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
              )}
            </CardBody>
          </Card>
        </div>
        <div className="flex-1 min-w-[180px] flex flex-col gap-3">
          <Card className="h-full">
            <CardBody className="py-3">
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                Mana Curve Share
              </Text>
              {!activeDecks ? (
                <OverviewChartSpinner />
              ) : (
                <ManaCurveShareChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
              )}
            </CardBody>
          </Card>
          <Card className="h-full">
            <CardBody className="py-3">
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                Elo Distribution
              </Text>
              {!activeDecks ? (
                <OverviewChartSpinner />
              ) : (
                <EloDistributionChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
              )}
            </CardBody>
          </Card>
        </div>
      </Flexbox>
    </Collapse>
  </div>
);

export const DraftSimulatorDesktopView: React.FC<{
  overview: React.ReactNode;
  map: React.ReactNode;
  filters: React.ReactNode;
  oovWarning?: React.ReactNode;
  bottom: React.ReactNode;
}> = ({ overview, map, filters, oovWarning, bottom }) => (
  <>
    {overview}
    <div className="simSection simSectionCards flex flex-col gap-5 pt-2">
      <Flexbox direction="col" gap="4">
        <div className="simCardDiagBlock simCardDiagSummary flex flex-col gap-4">{map}</div>
      </Flexbox>
    </div>
    {filters}
    {oovWarning}
    {bottom}
  </>
);

export const DraftSimulatorMobileView: React.FC<{
  overview: React.ReactNode;
  filters: React.ReactNode;
  detail?: React.ReactNode;
  archetypes: React.ReactNode;
  oovWarning?: React.ReactNode;
  bottom: React.ReactNode;
}> = ({ overview, filters, detail, archetypes, oovWarning, bottom }) => (
  <>
    {overview}
    {filters}
    <div className="flex flex-col gap-4">
      {detail}
      {archetypes}
    </div>
    {oovWarning}
    {bottom}
  </>
);
