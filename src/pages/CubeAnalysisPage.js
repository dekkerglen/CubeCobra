import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Col, Nav, NavLink, Row, Card, CardBody } from 'reactstrap';

import CubeLayout from 'layouts/CubeLayout';

import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';

import Averages from 'analytics/Averages';
import Chart from 'analytics/Chart';
import Tokens from 'analytics/Tokens';
import PivotTable from 'analytics/PivotTable';
import Table from 'analytics/Table';
import Cloud from 'analytics/Cloud';
import HyperGeom from 'analytics/HyperGeom';
import Suggestions from 'analytics/Suggestions';
import Asfans from 'analytics/Asfans';
import {
  cardCmc,
  cardDevotion,
  cardFoilPrice,
  cardNormalPrice,
  cardPower,
  cardPrice,
  cardToughness,
  cardPriceEur,
  cardTix,
} from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import FilterCollapse from 'components/FilterCollapse';
import useToggle from 'hooks/UseToggle';
import Query from 'utils/Query';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CubeAnalysisPage = ({
  user,
  cube,
  cubeID,
  defaultFilterText,
  defaultTab,
  defaultFormatId,
  cubes,
  loginCallback,
}) => {
  const [filter, setFilter] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultTab ?? 0);
  const [adds, setAdds] = useState([]);
  const [cuts, setCuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCollapseOpen, toggleFilterCollapse] = useToggle(false);
  const [asfans, setAsfans] = useState({});
  const didMountRef = useRef(false);

  useEffect(() => {
    if (didMountRef.current) {
      Query.set('tab', activeTab);
    } else {
      const queryTab = Query.get('tab');
      if (queryTab || queryTab === 0) {
        setActiveTab(queryTab);
      }
      didMountRef.current = true;
    }
  }, [activeTab]);

  const cards = useMemo(() => {
    return (filter ? cube.cards.filter(filter) : cube.cards).map((card) => ({ ...card, asfan: asfans[card.cardID] }));
  }, [asfans, cube, filter]);

  const characteristics = {
    CMC: cardCmc,
    Power: (card) => parseInt(cardPower(card), 10),
    Toughness: (card) => parseInt(cardToughness(card), 10),
    Elo: (card) => parseFloat(card.details.elo, 10),
    Price: (card) => parseFloat(cardPrice(card), 10),
    'Price USD': (card) => parseFloat(cardNormalPrice(card)),
    'Price USD Foil': (card) => parseFloat(cardFoilPrice(card)),
    'Price EUR': (card) => parseFloat(cardPriceEur(card)),
    'MTGO TIX': (card) => parseFloat(cardTix(card)),
    'Devotion to White': (card) => cardDevotion(card, 'w'),
    'Devotion to Blue': (card) => cardDevotion(card, 'u'),
    'Devotion to Black': (card) => cardDevotion(card, 'b'),
    'Devotion to Red': (card) => cardDevotion(card, 'r'),
    'Devotion to Green': (card) => cardDevotion(card, 'g'),
  };

  const analytics = [
    {
      name: 'Averages',
      component: (collection) => (
        <Averages
          cards={collection}
          characteristics={characteristics}
          defaultFormatId={defaultFormatId}
          cube={cube}
          setAsfans={setAsfans}
        />
      ),
    },
    {
      name: 'Table',
      component: (collection) => (
        <Table cards={collection} setAsfans={setAsfans} defaultFormatId={defaultFormatId} cube={cube} />
      ),
    },
    {
      name: 'Asfans',
      component: (collection) => <Asfans cards={collection} cube={cube} />,
    },
    {
      name: 'Chart',
      component: (collection) => (
        <Chart
          cards={collection}
          characteristics={characteristics}
          setAsfans={setAsfans}
          defaultFormatId={defaultFormatId}
          cube={cube}
        />
      ),
    },
    {
      name: 'Recommender',
      component: (collection, cubeObj, addCards, cutCards, isLoading) => (
        <Suggestions
          cards={collection}
          cube={cubeObj}
          adds={addCards}
          cuts={cutCards}
          filter={filter}
          loading={isLoading}
          cubes={cubes}
        />
      ),
    },
    {
      name: 'Tokens',
      component: (collection, cubeObj) => <Tokens cube={cubeObj} />,
    },
    {
      name: 'Tag Cloud',
      component: (collection) => (
        <Cloud cards={collection} setAsfans={setAsfans} defaultFormatId={defaultFormatId} cube={cube} />
      ),
    },
    {
      name: 'Pivot Table',
      component: (collection) => <PivotTable cards={collection} />,
    },
    {
      name: 'Hypergeometric Calculator',
      component: (collection) => <HyperGeom cards={collection} />,
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
    getData(`/cube/api/adds/${cubeID}`).then(({ toCut, toAdd }) => {
      setAdds(toAdd);
      setCuts(toCut);
      setLoading(false);
    });
  }, [cubeID]);

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeLayout cube={cube} canEdit={false} activeLink="analysis">
        <DynamicFlash />
        {cube.cards.length === 0 ? (
          <h5 className="mt-3 mb-3">This cube doesn't have any cards. Add cards to see analytics.</h5>
        ) : (
          <Row className="mt-3">
            <Col xs="12" lg="2">
              <Nav vertical="lg" pills className="justify-content-sm-start justify-content-center mb-3">
                {analytics.map((analytic, index) => (
                  <NavLink
                    key={analytic.name}
                    active={activeTab === index}
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
                    defaultFilterText={defaultFilterText}
                    filter={filter}
                    setFilter={setFilter}
                    numCards={cards.length}
                    isOpen={filterCollapseOpen}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <ErrorBoundary>{analytics[activeTab].component(cards, cube, adds, cuts, loading)}</ErrorBoundary>
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
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({ _id: PropTypes.string, title: PropTypes.string })),
    defaultDraftFormat: PropTypes.number,
  }).isRequired,
  cubeID: PropTypes.string.isRequired,
  defaultFilterText: PropTypes.string,
  defaultTab: PropTypes.number,
  defaultFormatId: PropTypes.number,
  cubes: PropTypes.arrayOf(PropTypes.shape({})),
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubeAnalysisPage.defaultProps = {
  defaultFilterText: '',
  defaultTab: 0,
  defaultFormatId: null,
  cubes: [],
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeAnalysisPage);
