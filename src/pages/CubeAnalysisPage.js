import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Nav, NavLink, Row, Card, CardBody } from 'reactstrap';

import Averages from 'analytics/Averages';
import ChartComponent from 'analytics/Chart';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import Tokens from 'analytics/Tokens';
import Playtest from 'analytics/PlaytestData';
import AnalyticTable from 'analytics/AnalyticTable';
import Suggestions from 'analytics/Suggestions';
import Asfans from 'analytics/Asfans';
import FilterCollapse from 'components/FilterCollapse';
import useQueryParam from 'hooks/useQueryParam';
import useToggle from 'hooks/UseToggle';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CubePropType from 'proptypes/CubePropType';
import CubeAnalyticPropType from 'proptypes/CubeAnalyticPropType';
import {
  cardCmc,
  cardDevotion,
  cardFoilPrice,
  cardNormalPrice,
  cardEtchedPrice,
  cardPower,
  cardPrice,
  cardToughness,
  cardPriceEur,
  cardTix,
  mainboardRate,
  pickRate,
} from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import RenderToRoot from 'utils/RenderToRoot';
import { getLabels, cardIsLabel } from 'utils/Sort';

const CubeAnalysisPage = ({ cube, loginCallback, cubeAnalytics, cards }) => {
  const [filter, setFilter] = useState(null);
  const [activeTab, setActiveTab] = useQueryParam('tab', 0);
  const [adds, setAdds] = useState([]);
  const [cuts, setCuts] = useState([]);
  const [loading, setLoading] = useState('loading');
  const [filterCollapseOpen, toggleFilterCollapse] = useToggle(false);

  const filteredCards = useMemo(() => {
    return (filter ? cards.mainboard.filter(filter) : cards.mainboard).map((card) => ({
      ...card,
    }));
  }, [cards, filter]);

  const convertToCharacteristic = (name, func) => ({
    get: func,
    labels: (list) => getLabels(list, name),
    cardIsLabel: (card, label) => cardIsLabel(card, label.toString(), name),
  });

  const getCubeElo = (card) =>
    cubeAnalytics[card.details.oracle_id] ? Math.round(cubeAnalytics[card.details.oracle_id].elo) : null;

  const getPickRate = (card) =>
    cubeAnalytics[card.details.oracle_id] ? pickRate(cubeAnalytics[card.details.oracle_id]) : null;

  const getPickCount = (card) =>
    cubeAnalytics[card.details.oracle_id] ? cubeAnalytics[card.details.oracle_id].picks : null;

  const getMainboardRate = (card) =>
    cubeAnalytics[card.details.oracle_id] ? mainboardRate(cubeAnalytics[card.details.oracle_id]) : null;

  const getMainboardCount = (card) =>
    cubeAnalytics[card.details.oracle_id] ? cubeAnalytics[card.details.oracle_id].mainboards : null;

  const characteristics = {
    'Mana Value': convertToCharacteristic('Mana Value', cardCmc),
    Power: convertToCharacteristic('Power', (card) => parseInt(cardPower(card), 10)),
    Toughness: convertToCharacteristic('Toughness', (card) => parseInt(cardToughness(card), 10)),
    elo: convertToCharacteristic('elo', (card) => parseFloat(card.details.elo, 10)),
    Price: convertToCharacteristic('Price', (card) => parseFloat(cardPrice(card), 10)),
    'Price USD': convertToCharacteristic('Price USD', (card) => parseFloat(cardNormalPrice(card))),
    'Price USD Foil': convertToCharacteristic('Price USD Foil', (card) => parseFloat(cardFoilPrice(card))),
    'Price USD Etched': convertToCharacteristic('Price USD Etched', (card) => parseFloat(cardEtchedPrice(card))),
    'Price EUR': convertToCharacteristic('Price EUR', (card) => parseFloat(cardPriceEur(card))),
    'MTGO TIX': convertToCharacteristic('MTGO TIX', (card) => parseFloat(cardTix(card))),
    'Cube elo': {
      get: getCubeElo,
      labels: (list) =>
        getLabels(
          list.map((card) => {
            const newcard = JSON.parse(JSON.stringify(card));
            newcard.details.elo = getCubeElo(card);
            return newcard;
          }),
          'elo',
        ),
      cardIsLabel: (card, label) => {
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
      cardIsLabel: (card, label) => {
        const v = Math.floor(getPickRate(card) * 10) * 10;
        return label === `${v}% - ${v + 10}%`;
      },
    },
    'Pick Count': {
      get: getPickCount,
      labels: (list) => {
        const set = new Set(list.map(getPickCount));

        return Array.from(set)
          .filter((c) => c)
          .sort();
      },
      cardIsLabel: (card, label) => getPickCount(card) === parseInt(label, 10),
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
      cardIsLabel: (card, label) => {
        const v = Math.floor(getMainboardRate(card) * 10) * 10;
        return label === `${v}% - ${v + 10}%`;
      },
    },
    'mainboard Count': {
      get: getMainboardCount,
      labels: (list) => {
        const set = new Set(list.map(getMainboardCount));

        return Array.from(set)
          .filter((c) => c)
          .sort();
      },
      cardIsLabel: (card, label) => getMainboardCount(card) === parseInt(label, 10),
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
      component: (collection) => <Averages cards={collection} characteristics={characteristics} cube={cube} />,
    },
    {
      name: 'Table',
      component: (collection) => <AnalyticTable cards={collection} cube={cube} />,
    },
    {
      name: 'Asfans',
      component: (collection) => <Asfans cards={collection} cube={cube} />,
    },
    {
      name: 'Chart',
      component: (collection) => <ChartComponent cards={collection} characteristics={characteristics} cube={cube} />,
    },
    {
      name: 'Recommender',
      component: (collection, cubeObj, addCards, cutCards, loadState) => (
        <Suggestions
          cards={collection}
          cube={cubeObj}
          adds={addCards}
          cuts={cutCards}
          filter={filter}
          loadState={loadState}
        />
      ),
    },
    {
      name: 'Playtest Data',
      component: (collection) => <Playtest cards={collection} cubeAnalytics={cubeAnalytics} />,
    },
    {
      name: 'Tokens',
      component: (collection, cubeObj) => <Tokens cards={collection} cube={cubeObj} />,
    },
  ];

  async function getData(url = '') {
    // Default options are marked with *
    const response = await csrfFetch(url, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'Content-Type': 'application/json',
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const val = await response.json(); // parses JSON response into native JavaScript objects
    return val.result;
  }

  useEffect(() => {
    getData(`/cube/api/adds/${cube.id}`)
      .then(({ toCut, toAdd }) => {
        setAdds(toAdd);
        setCuts(toCut);
        setLoading('loaded');
      })
      .catch(() => {
        setLoading('error');
      });
  }, [cube.id]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} canEdit={false} activeLink="analysis">
        <DynamicFlash />
        {cards.mainboard.length === 0 ? (
          <h5 className="mt-3 mb-3">This cube doesn't have any cards. Add cards to see analytics.</h5>
        ) : (
          <Row className="mt-3">
            <Col xs="12" lg="2">
              <Nav vertical="lg" pills className="justify-content-sm-start justify-content-center mb-3">
                {analytics.map((analytic, index) => (
                  <NavLink
                    key={analytic.name}
                    active={`${activeTab}` === `${index}`}
                    onClick={() => setActiveTab(index)}
                    href="#"
                  >
                    {analytic.name}
                  </NavLink>
                ))}
              </Nav>
            </Col>
            <Col xs="12" lg="10" className="overflow-x">
              <Card className="mb-3">
                <CardBody>
                  <NavLink href="#" onClick={toggleFilterCollapse}>
                    <h5>{filterCollapseOpen ? 'Hide Filter' : 'Show Filter'}</h5>
                  </NavLink>
                  <FilterCollapse
                    filter={filter}
                    setFilter={setFilter}
                    numCards={filteredCards.length}
                    isOpen={filterCollapseOpen}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <ErrorBoundary>
                    {analytics[activeTab].component(filteredCards, cube, adds, cuts, loading)}
                  </ErrorBoundary>
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}
      </CubeLayout>
    </MainLayout>
  );
};

CubeAnalysisPage.propTypes = {
  cube: CubePropType.isRequired,
  cards: PropTypes.shape({
    mainboard: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  loginCallback: PropTypes.string,
  cubeAnalytics: CubeAnalyticPropType.isRequired,
};

CubeAnalysisPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeAnalysisPage);
