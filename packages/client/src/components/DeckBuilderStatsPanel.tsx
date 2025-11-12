import React, { useContext } from 'react';

import Card from '@utils/datatypes/Card';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title } from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { Card as CardComponent, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import DisplayContext from 'contexts/DisplayContext';

import { getCardCountByColor, getCurveByColors, getManaSymbolCount, getSourcesDistribution } from '../utils/deckutil';
import Tooltip from './base/Tooltip';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Legend);

interface DeckBuilderStatsPanelProps {
  cards: Card[];
}

const displayPercentage = (nom: number, denom: number): string => {
  if (nom === 0) {
    return '0%';
  }

  if (denom === 0) {
    return '100%';
  }

  return `${((nom / denom) * 100).toFixed(0)}%`;
};

const DeckBuilderStatsPanel: React.FC<DeckBuilderStatsPanelProps> = ({ cards }) => {
  const { showDeckBuilderStatsPanel } = useContext(DisplayContext);

  if (!showDeckBuilderStatsPanel) {
    return null;
  }

  const manaSymbolCounts = getManaSymbolCount(cards);
  const cardColorCounts = getCardCountByColor(cards);
  const sourcesInDeck = getSourcesDistribution(cards);
  const curveByColors = getCurveByColors(cards, [0, 1, 2, 3, 4, 5]);

  const manaData = [
    {
      color: 'White',
      symbol: 'w',
      cardCount: cardColorCounts.W,
      symbolCount: manaSymbolCounts.W,
      curve: curveByColors.W,
      landProduction: sourcesInDeck.W,
    },
    {
      color: 'Blue',
      symbol: 'u',
      cardCount: cardColorCounts.U,
      symbolCount: manaSymbolCounts.U,
      curve: curveByColors.U,
      landProduction: sourcesInDeck.U,
    },
    {
      color: 'Black',
      symbol: 'b',
      cardCount: cardColorCounts.B,
      symbolCount: manaSymbolCounts.B,
      curve: curveByColors.B,
      landProduction: sourcesInDeck.B,
    },
    {
      color: 'Red',
      symbol: 'r',
      cardCount: cardColorCounts.R,
      symbolCount: manaSymbolCounts.R,
      curve: curveByColors.R,
      landProduction: sourcesInDeck.R,
    },
    {
      color: 'Green',
      symbol: 'g',
      cardCount: cardColorCounts.G,
      symbolCount: manaSymbolCounts.G,
      curve: curveByColors.G,
      landProduction: sourcesInDeck.G,
    },
    {
      color: 'Colorless',
      symbol: 'c',
      cardCount: cardColorCounts.C,
      symbolCount: manaSymbolCounts.C,
      curve: curveByColors.C,
      landProduction: sourcesInDeck.C,
    },
  ];

  const colorStyles: Record<string, string> = {
    White: `bg-yellow-300 text-gray-800`,
    Blue: `bg-blue-500 text-white`,
    Black: `bg-gray-800 text-white`,
    Red: `bg-red-500 text-white`,
    Green: `bg-green-500 text-white`,
    Colorless: `bg-purple-600 text-white`,
  };

  const colors: Record<string, string> = {
    White: 'rgb(253 224 71)',
    Blue: 'rgb(59 130 246)',
    Black: 'rgb(31 41 55)',
    Red: 'rgb(239 68 68)',
    Green: 'rgb(34 197 94)',
    Colorless: 'rgb(147 51 234)',
  };

  return (
    <CardComponent className="my-3">
      <CardHeader>
        <Text lg semibold>
          Mana Breakdown
        </Text>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {manaData.map(({ color, symbol, cardCount, symbolCount, curve, landProduction }) => (
            <div key={color} className="bg-white rounded-lg p-4 shadow-sm flex flex-col items-center text-center">
              <img alt={symbol} className="w-16 h-16 mb-1" src={`/content/symbols/${symbol}.png`} />

              {/* Percentage with Tooltip */}
              <Tooltip text={`${cardCount ?? 0} of ${cards.length} cards are ${color}`}>
                <h3 className="text-lg font-bold cursor-pointer">{displayPercentage(cardCount, cards.length)}</h3>
              </Tooltip>

              <Tooltip text={`${symbolCount ?? 0} of ${manaSymbolCounts.total} symbols are ${color.toLowerCase()}`}>
                <p className="text-xs text-gray-500 mt-1">
                  {displayPercentage(symbolCount, manaSymbolCounts.total)} of all symbols
                </p>
              </Tooltip>

              {/* Mana Curve Bar Chart */}
              <div className="w-full h-12 my-1">
                <Bar
                  data={{
                    labels: ['0', '1', '2', '3', '4', '5+'],
                    datasets: [
                      {
                        label: 'Cards',
                        data: curve,
                        backgroundColor: colors[color],
                        borderColor: 'black',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        display: true,
                        title: { display: false },
                        ticks: {
                          font: {
                            size: 10,
                            lineHeight: 0.5,
                          },
                          maxRotation: 0,
                          minRotation: 0,
                          autoSkip: true,
                          maxTicksLimit: 10,
                          padding: 2,
                        },
                        grid: {
                          display: false,
                        },
                      },
                      y: { display: false },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>

              <div className="w-full border-b-2 border-gray-300 opacity-50 my-1"></div>

              {/* Mana Production Bar */}
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className={`h-full ${colorStyles[color]} flex items-center justify-center text-xs font-bold`}
                  style={{ width: `${displayPercentage(landProduction, sourcesInDeck.total)}` }}
                >
                  {landProduction > 0 ? displayPercentage(landProduction, sourcesInDeck.total) : ''}
                </div>
              </div>
              <p className="text-xs">
                {landProduction > 0
                  ? landProduction === sourcesInDeck.total
                    ? `All lands produce ${color.toLowerCase()}`
                    : `${landProduction} out of ${sourcesInDeck.total} lands produce ${color.toLowerCase()}`
                  : `No land produces ${color.toLowerCase()}`}
              </p>
            </div>
          ))}
        </div>
      </CardBody>
    </CardComponent>
  );
};

export default DeckBuilderStatsPanel;
