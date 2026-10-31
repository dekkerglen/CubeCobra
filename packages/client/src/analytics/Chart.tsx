import React, { useContext, useMemo } from 'react';

import Card from '@utils/datatypes/Card';
import { calculateAsfans } from '@utils/drafting/createdraft';
import { getAllSorts, sortIntoGroups } from '@utils/sorting/Sort';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import AsfanDropdown from '../components/analytics/AsfanDropdown';
import { chartCardListHandlers, useCardListModal } from '../components/analytics/CardListModal';
import { barLegendLabels } from '../components/analytics/chartLegend';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Select from '../components/base/Select';
import Text from '../components/base/Text';
import { useAnalysisCards } from '../contexts/AnalysisViewContext';
import CubeContext from '../contexts/CubeContext';
import useQueryParam from '../hooks/useQueryParam';
import { getDefaultDraftFormatValue } from '../utils/draftFormats';

// Register the necessary Chart.js components
ChartJS.register(CategoryScale, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend, BarElement);

interface Characteristics {
  [key: string]: {
    labels: (cards: Card[], characteristic: string) => string[];
    cardIsLabel: (card: Card, label: string) => boolean;
  };
}

interface ChartComponentProps {
  characteristics: Characteristics;
}

const COLOR_MAP: { [key: string]: string } = {
  White: '#D8CEAB',
  Blue: '#67A6D3',
  Black: '#8C7A91',
  Red: '#D85F69',
  Green: '#6AB572',
  Colorless: '#ADADAD',
  Multicolored: '#DBC467',
};

const COLORS = [...Object.values(COLOR_MAP), '#000000'];

const getColor = (label: string, index: number): string => {
  return COLOR_MAP[label] ?? COLORS[index % COLORS.length];
};

const ChartComponent: React.FC<ChartComponentProps> = ({ characteristics }) => {
  const { cube } = useContext(CubeContext);
  const cards = useAnalysisCards();

  const [sort, setSort] = useQueryParam('sort', 'Color Identity');
  const [characteristic, setCharacteristic] = useQueryParam('field', 'Mana Value');
  const [useAsfans, setUseAsfans] = useQueryParam('asfans', 'false');
  const [draftFormat, setDraftFormat] = useQueryParam('format', getDefaultDraftFormatValue(cube));

  const allSorts = useMemo(() => getAllSorts(cube), [cube]);
  const { openCardList, cardListModal } = useCardListModal();

  const groups = sortIntoGroups(cards, sort, false, cube);

  const labels = useMemo(
    () => characteristics[characteristic].labels(cards, characteristic),
    [characteristic, characteristics, cards],
  );

  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { ...barLegendLabels } },
    },
    tooltips: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'nearest',
      intersect: true,
    },
    scales: {
      x: {
        display: true,
        scaleLabel: {
          display: true,
          labelString: characteristic,
        },
      },
      y: {
        display: true,
        scaleLabel: {
          display: true,
          labelString: 'Count',
        },
      },
    },
    ...chartCardListHandlers((datasetIndex, index) => {
      const groupKey = Object.keys(groups)[datasetIndex];
      const label = labels[index];
      return {
        title: sort === 'Unsorted' ? `${characteristic}: ${label}` : `${characteristic}: ${label} · ${groupKey}`,
        cards: groups[groupKey].filter((card) => characteristics[characteristic].cardIsLabel(card, label)),
      };
    }, openCardList),
  };

  const asfans = useMemo(() => {
    if (useAsfans !== 'true') {
      return {};
    }
    try {
      return calculateAsfans(cube, cards, parseInt(draftFormat, 10));
    } catch (e) {
      console.error('Invalid Draft Format', draftFormat, cube.formats[parseInt(draftFormat, 10)], e);
      return {};
    }
  }, [cards, cube, draftFormat, useAsfans]);

  const data = useMemo(
    () => ({
      labels,
      datasets: Object.keys(groups).map((key, index) => ({
        label: key,
        data: labels.map((label) =>
          groups[key]
            .filter((card) => characteristics[characteristic].cardIsLabel(card, label))
            .reduce((acc, card) => acc + (asfans[card.cardID] || 1), 0),
        ),
        backgroundColor: getColor(key, index),
        borderColor: getColor(key, index),
      })),
    }),
    [labels, groups, characteristics, characteristic, asfans],
  );

  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <Text>View the counts of a characteristic on a chart. For unstacked columns, use 'Unsorted'.</Text>
      <Row>
        <Col xs={12} md={6}>
          <Select
            label="Group By"
            options={allSorts.map((item) => ({ value: item, label: item }))}
            value={sort}
            setValue={setSort}
          />
        </Col>
        <Col xs={12} md={6}>
          <Select
            label="Characteristic"
            options={Object.keys(characteristics).map((item) => ({ value: item, label: item }))}
            value={characteristic}
            setValue={setCharacteristic}
          />
        </Col>
      </Row>
      <AsfanDropdown
        cube={cube}
        draftFormat={draftFormat}
        setDraftFormat={setDraftFormat}
        useAsfans={useAsfans === 'true'}
        setUseAsfans={(val) => setUseAsfans(val.toString())}
      />
      <Bar options={options as any} data={data} />
      {cardListModal}
    </Flexbox>
  );
};

export default ChartComponent;
