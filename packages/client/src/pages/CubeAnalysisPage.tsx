import React, { useContext } from 'react';

import {
  cardCmc,
  cardDevotion,
  cardElo,
  cardEtchedPrice,
  cardFoilPrice,
  cardNormalPrice,
  cardPower,
  cardPrice,
  cardPriceEur,
  cardTix,
  cardToughness,
  mainboardRate,
  pickRate,
} from '@utils/cardutil';
import CardType, { DefaultElo } from '@utils/datatypes/Card';
import Cube, { CubeCards } from '@utils/datatypes/Cube';
import { cardIsLabel, getLabels } from '@utils/sorting/Sort';

import AnalyticTable from '../analytics/AnalyticTable';
import Asfans from '../analytics/Asfans';
import Averages from '../analytics/Averages';
import ChartComponent from '../analytics/Chart';
import Combos from '../analytics/Combos';
import Playtest from '../analytics/PlaytestData';
import Suggestions from '../analytics/Suggestions';
import Tokens from '../analytics/Tokens';
import { Card } from '../components/base/Card';
import { TabbedView } from '../components/base/Tabs';
import Text from '../components/base/Text';
import DynamicFlash from '../components/DynamicFlash';
import FilterCollapse from '../components/FilterCollapse';
import RenderToRoot from '../components/RenderToRoot';
import CubeContext from '../contexts/CubeContext';
import useQueryParam from '../hooks/useQueryParam';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';

interface CubeAnalysisPageProps {
  cubeAnalytics: any;
  tokenMap: { [key: string]: CardType };
}

const CubeAnalysisPage: React.FC<CubeAnalysisPageProps> = ({ cubeAnalytics, tokenMap }) => {
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');
  const { cube } = useContext(CubeContext);

  const convertToCharacteristic = (name: string, func: (card: any) => any) => ({
    get: func,
    labels: (list: any[]) => getLabels(list, name),
    cardIsLabel: (card: any, label: string) => cardIsLabel(card, label.toString(), name),
  });

  const getCubeElo = (card: any) =>
    cubeAnalytics[card.details.oracle_id] ? Math.round(cubeAnalytics[card.details.oracle_id].elo) : DefaultElo;

  const getPickRate = (card: any) =>
    cubeAnalytics[card.details.oracle_id] ? pickRate(cubeAnalytics[card.details.oracle_id]) : 0;

  const getPickCount = (card: any) =>
    cubeAnalytics[card.details.oracle_id] ? cubeAnalytics[card.details.oracle_id].picks : 0;

  const getMainboardRate = (card: any) =>
    cubeAnalytics[card.details.oracle_id] ? mainboardRate(cubeAnalytics[card.details.oracle_id]) : 0;

  const getMainboardCount = (card: any) =>
    cubeAnalytics[card.details.oracle_id] ? cubeAnalytics[card.details.oracle_id].mainboards : 0;

  const characteristics = {
    'Mana Value': convertToCharacteristic('Mana Value', cardCmc),
    Power: convertToCharacteristic('Power', (card) => cardPower(card)),
    Toughness: convertToCharacteristic('Toughness', (card) => cardToughness(card)),
    elo: convertToCharacteristic('elo', (card) => cardElo(card)),
    Price: convertToCharacteristic('Price', (card) => cardPrice(card) ?? 0),
    'Price USD': convertToCharacteristic('Price USD', (card) => cardNormalPrice(card) ?? 0),
    'Price USD Foil': convertToCharacteristic('Price USD Foil', (card) => cardFoilPrice(card) ?? 0),
    'Price USD Etched': convertToCharacteristic('Price USD Etched', (card) => cardEtchedPrice(card) ?? 0),
    'Price EUR': convertToCharacteristic('Price EUR', (card) => cardPriceEur(card) ?? 0),
    'MTGO TIX': convertToCharacteristic('MTGO TIX', (card) => cardTix(card) ?? 0),
    'Cube elo': {
      get: getCubeElo,
      labels: (list: any[]) =>
        getLabels(
          list.map((card) => {
            const newcard = JSON.parse(JSON.stringify(card));
            newcard.details.elo = getCubeElo(card);
            return newcard;
          }),
          'elo',
        ),
      cardIsLabel: (card: any, label: string) => {
        const newcard = JSON.parse(JSON.stringify(card));
        newcard.details.elo = getCubeElo(card);

        return cardIsLabel(newcard, label, 'elo');
      },
    },
    'Pick Rate': {
      get: getPickRate,
      labels: () => {
        const labels = [];
        for (let i = 0; i < 10; i++) {
          labels.push(`${i * 10}% - ${(i + 1) * 10}%`);
        }
        return labels;
      },
      cardIsLabel: (card: any, label: string) => {
        const v = Math.floor(getPickRate(card) * 10) * 10;
        return label === `${v}% - ${v + 10}%`;
      },
    },
    'Pick Count': {
      get: getPickCount,
      labels: (list: any[]) => {
        const set = new Set(list.map(getPickCount));

        return Array.from(set)
          .filter((c) => c)
          .sort();
      },
      cardIsLabel: (card: any, label: string) => getPickCount(card) === parseInt(label, 10),
    },
    'mainboard Rate': {
      get: getMainboardRate,
      labels: () => {
        const labels = [];
        for (let i = 0; i < 10; i++) {
          labels.push(`${i * 10}% - ${(i + 1) * 10}%`);
        }
        return labels;
      },
      cardIsLabel: (card: any, label: string) => {
        const v = Math.floor(getMainboardRate(card) * 10) * 10;
        return label === `${v}% - ${v + 10}%`;
      },
    },
    'mainboard Count': {
      get: getMainboardCount,
      labels: (list: any[]) => {
        const set = new Set(list.map(getMainboardCount));

        return Array.from(set)
          .filter((c) => c)
          .sort();
      },
      cardIsLabel: (card: any, label: string) => getMainboardCount(card) === parseInt(label, 10),
    },
    'Devotion to White': convertToCharacteristic('Devotion to White', (card) => cardDevotion(card, 'w').toString()),
    'Devotion to Blue': convertToCharacteristic('Devotion to Blue', (card) => cardDevotion(card, 'u').toString()),
    'Devotion to Black': convertToCharacteristic('Devotion to Black', (card) => cardDevotion(card, 'b').toString()),
    'Devotion to Red': convertToCharacteristic('Devotion to Red', (card) => cardDevotion(card, 'r').toString()),
    'Devotion to Green': convertToCharacteristic('Devotion to Green', (card) => cardDevotion(card, 'g').toString()),
  };

  const analytics = [
    {
      name: 'Averages',
      component: () => <Averages characteristics={characteristics} />,
    },
    {
      name: 'Table',
      component: () => <AnalyticTable />,
    },
    {
      name: 'Asfans',
      component: () => <Asfans />,
    },
    {
      name: 'Chart',
      component: () => <ChartComponent characteristics={characteristics} />,
    },
    {
      name: 'Recommender',
      component: () => <Suggestions />,
    },
    {
      name: 'Playtest Data',
      component: () => <Playtest cubeAnalytics={cubeAnalytics} />,
    },
    {
      name: 'Tokens',
      component: () => <Tokens tokenMap={tokenMap} />,
    },
    {
      name: 'Combos',
      component: () => <Combos />,
    },
  ];

  return (
    <>
      <DynamicFlash />
      {cube.cards.mainboard.length === 0 ? (
        <Text lg>This cube doesn't have any cards. Add cards to see analytics.</Text>
      ) : (
        <Card className="my-2">
          <FilterCollapse
            isOpen={true}
            className="p-2"
            filterTextFn={({ mainboard }) =>
              mainboard
                ? `Calculating analytics for ${mainboard[0]} / ${mainboard[1]} cards in mainboard.`
                : 'No cards for analytics.'
            }
            showReset
          />
          <TabbedView
            activeTab={parseInt(activeTab || '0', 10)}
            tabs={analytics.map((analytic, index) => ({
              label: analytic.name,
              onClick: () => setActiveTab(`${index}`),
              content: analytic.component(),
            }))}
          />
        </Card>
      )}
    </>
  );
};

interface CubeAnalysisPageWrapperProps {
  cube: Cube; // Adjust the type as needed
  cards: CubeCards;
  cubeAnalytics: any; // Adjust the type as needed
  tokenMap: { [key: string]: CardType };
}

const CubeAnalysisPageWrapper: React.FC<CubeAnalysisPageWrapperProps> = ({ cube, cards, cubeAnalytics, tokenMap }) => {
  return (
    <MainLayout>
      <CubeLayout cube={cube} cards={cards} activeLink="analysis">
        <CubeAnalysisPage cubeAnalytics={cubeAnalytics} tokenMap={tokenMap} />
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeAnalysisPageWrapper);
