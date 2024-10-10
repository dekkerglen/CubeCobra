import React, { useContext } from 'react';

import AnalyticTable from 'analytics/AnalyticTable';
import Asfans from 'analytics/Asfans';
import Averages from 'analytics/Averages';
import ChartComponent from 'analytics/Chart';
import Playtest from 'analytics/PlaytestData';
import Suggestions from 'analytics/Suggestions';
import Tokens from 'analytics/Tokens';
import { Card } from 'components/base/Card';
import { TabbedView } from 'components/base/Tabs';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import FilterCollapse from 'components/FilterCollapse';
import RenderToRoot from 'components/RenderToRoot';
import CubeContext from 'contexts/CubeContext';
import { FilterContextProvider } from 'contexts/FilterContext';
import CardType from 'datatypes/Card';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
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
} from 'utils/Card';
import { cardIsLabel, getLabels } from 'utils/Sort';

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
    cubeAnalytics[card.details.oracle_id] ? Math.round(cubeAnalytics[card.details.oracle_id].elo) : 1200;

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
    Price: convertToCharacteristic('Price', (card) => cardPrice(card)),
    'Price USD': convertToCharacteristic('Price USD', (card) => cardNormalPrice(card)),
    'Price USD Foil': convertToCharacteristic('Price USD Foil', (card) => cardFoilPrice(card)),
    'Price USD Etched': convertToCharacteristic('Price USD Etched', (card) => cardEtchedPrice(card)),
    'Price EUR': convertToCharacteristic('Price EUR', (card) => cardPriceEur(card)),
    'MTGO TIX': convertToCharacteristic('MTGO TIX', (card) => cardTix(card)),
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
  cube: any; // Adjust the type as needed
  cards: {
    mainboard: any[];
    maybeboard: any[];
  };
  loginCallback?: string;
  cubeAnalytics: any; // Adjust the type as needed
  tokenMap: { [key: string]: CardType };
}

const CubeAnalysisPageWrapper: React.FC<CubeAnalysisPageWrapperProps> = ({
  cube,
  cards,
  loginCallback = '/',
  cubeAnalytics,
  tokenMap,
}) => {
  return (
    <FilterContextProvider>
      <MainLayout loginCallback={loginCallback}>
        <CubeLayout cube={cube} cards={cards} activeLink="analysis">
          <CubeAnalysisPage cubeAnalytics={cubeAnalytics} tokenMap={tokenMap} />
        </CubeLayout>
      </MainLayout>
    </FilterContextProvider>
  );
};

export default RenderToRoot(CubeAnalysisPageWrapper);
