import React, { useContext } from 'react';

import { cdnUrl } from '@utils/cdnUrl';
import Card from '@utils/datatypes/Card';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title } from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { Card as CardComponent, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import DisplayContext from 'contexts/DisplayContext';
import useChartTextColor from 'hooks/useChartTextColor';

import { getDeckColorStats, percentOf } from '../utils/deckutil';
import Tooltip from './base/Tooltip';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Legend);

interface DeckBuilderStatsPanelProps {
  cards: Card[];
}

const displayPercentage = (nom: number, denom: number): string => `${percentOf(nom, denom)}%`;

const DeckBuilderStatsPanel: React.FC<DeckBuilderStatsPanelProps> = ({ cards }) => {
  const { showDeckBuilderStatsPanel } = useContext(DisplayContext);
  const chartTextColor = useChartTextColor();

  if (!showDeckBuilderStatsPanel) {
    return null;
  }

  const stats = getDeckColorStats(cards);

  const colorStyles: Record<string, string> = {
    White: `bg-yellow-300 text-gray-800`,
    Blue: `bg-blue-500 text-white`,
    Black: `bg-gray-500 text-white`,
    Red: `bg-red-500 text-white`,
    Green: `bg-green-500 text-white`,
    Colorless: `bg-purple-600 text-white`,
  };

  const colors: Record<string, string> = {
    White: 'rgb(253 224 71)',
    Blue: 'rgb(59 130 246)',
    Black: 'rgb(107 114 128)',
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
          {stats.colors.map(({ color, symbol, cardCount, symbolCount, symbolTotal, curve, sources, sourceTotal }) => (
            <div
              key={color}
              className="bg-bg-accent border border-border rounded-lg p-4 flex flex-col items-center text-center"
            >
              <img
                alt={symbol.toLowerCase()}
                className="w-16 h-16 mb-1"
                src={cdnUrl(`/content/symbols/${symbol.toLowerCase()}.png`)}
              />

              {/* Percentage with Tooltip */}
              <Tooltip
                text={
                  color === 'Colorless'
                    ? `${cardCount} of ${stats.spellCount} spells are colorless`
                    : `${cardCount} of ${stats.spellCount} spells include ${color.toLowerCase()}`
                }
              >
                <h3 className="text-lg font-bold cursor-pointer" data-testid="color-percentage">
                  {displayPercentage(cardCount, stats.spellCount)}
                </h3>
              </Tooltip>

              <Tooltip
                text={
                  color === 'Colorless'
                    ? `${symbolCount} of ${symbolTotal} mana symbols are colorless`
                    : `${symbolCount} of ${symbolTotal} mana symbols are ${color.toLowerCase()}`
                }
              >
                <p className="text-xs text-text-secondary mt-1">
                  {displayPercentage(symbolCount, symbolTotal)} of mana symbols
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
                        borderColor: chartTextColor,
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
                          color: chartTextColor,
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
                      y: { display: false, beginAtZero: true, max: stats.curveMax },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>

              <div className="w-full border-b-2 border-border opacity-50 my-1"></div>

              {/* Mana Production Bar */}
              <div className="w-full h-4 bg-bg-active rounded-full overflow-hidden relative">
                <div
                  className={`h-full ${colorStyles[color]} flex items-center justify-center text-xs font-bold`}
                  style={{ width: `${displayPercentage(sources, sourceTotal)}` }}
                >
                  {sources > 0 ? displayPercentage(sources, sourceTotal) : ''}
                </div>
              </div>
              <p className="text-xs">
                {sources > 0
                  ? sources === sourceTotal
                    ? `All lands produce ${color.toLowerCase()}`
                    : `${sources} out of ${sourceTotal} lands produce ${color.toLowerCase()}`
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
