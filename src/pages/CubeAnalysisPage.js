import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Col, Nav, NavLink, Row, Card, CardBody } from 'reactstrap';

import CubeLayout from 'layouts/CubeLayout';

import CubeAnalysisNavBar from 'components/CubeAnalysisNavbar';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';

import Averages from 'analytics/Averages';
import Filter from 'utils/Filter';
import Chart from 'analytics/Chart';
import Tokens from 'analytics/Tokens';
import PivotTable from 'analytics/PivotTable';
import Table from 'analytics/Table';
import Cloud from 'analytics/Cloud';
import HyperGeom from 'analytics/HyperGeom';
import Asfans from 'analytics/Asfans';
import Suggestions from 'analytics/Suggestions';
import { getCmc } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';

const CubeAnalysisPage = ({ cube, cubeID, defaultFilterText }) => {
  const [filter, setFilter] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [cards, setCards] = useState(cube.cards);
  const [suggestions, setSuggestions] = useState([]);
  const [removes, setRemoves] = useState([]);
  const [adds, setAdds] = useState([]);
  const [cuts, setCuts] = useState([]);
  const [loading, setLoading] = useState(true);

  const characteristics = {
    CMC: getCmc,
    Power: (card) => parseInt(card.details.power, 10),
    Toughness: (card) => parseInt(card.details.toughness, 10),
    Elo: (card) => parseFloat(card.details.elo, 10),
    Price: (card) =>
      parseFloat(
        card.finish === 'Foil'
          ? card.details.price_foil ?? card.details.price
          : card.details.price ?? card.details.price_foil,
        10,
      ),
    'Price Foil': (card) => parseFloat(card.details.price_foil),
    'Non-Foil Price': (card) => parseFloat(card.details.price),
  };

  const analytics = [
    {
      name: 'Averages',
      component: (collection) => <Averages cards={collection} characteristics={characteristics} />,
    },
    {
      name: 'Table',
      component: (collection) => <Table cards={collection} />,
    },
    {
      name: 'Chart',
      component: (collection) => <Chart cards={collection} characteristics={characteristics} />,
    },
    {
      name: 'Recommender',
      component: (collection, cubeObj, addCards, cutCards, isLoading) => (
        <Suggestions cards={collection} cube={cubeObj} adds={addCards} cuts={cutCards} loading={isLoading} />
      ),
    },
    {
      name: 'Asfans',
      component: (collection, cubeObj) => <Asfans cards={collection} cube={cubeObj} />,
    },
    {
      name: 'Tokens',
      component: (collection, cubeObj) => <Tokens cards={collection} cube={cubeObj} />,
    },
    {
      name: 'Tag Cloud',
      component: (collection) => <Cloud cards={collection} />,
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

  async function getData(url = '', data = {}) {
    // Default options are marked with *
    const response = await csrfFetch(url, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'Content-Type': 'application/json',
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    const val = await response.json(); // parses JSON response into native JavaScript objects
    return val.result;
  }

  useEffect(() => {
    getData(`/cube/api/adds/${cubeID}`, { cards: cards.map((card) => card.details.name) }).then(({ toCut, toAdd }) => {
      setSuggestions(toAdd);
      setRemoves(toCut);
      setAdds(toAdd);
      setCuts(toCut);
      setLoading(false);
    });
  }, [cards, cubeID]);

  const updateFilter = (val) => {
    setFilter(val);
    setCards(cube.cards.filter((card) => Filter.filterCard(card, val)));
    setAdds(suggestions.filter((card) => Filter.filterCard(card, val)));
    setCuts(removes.filter((card) => Filter.filterCard(card, val)));
  };

  return (
    <CubeLayout cube={cube} cubeID={cubeID} canEdit={false} activeLink="analysis">
      <DynamicFlash />
      <CubeAnalysisNavBar
        filter={filter}
        setFilter={updateFilter}
        numCards={cards.length}
        defaultFilterText={defaultFilterText}
      />
      <Row className="mt-3">
        <Col xs="12" lg="2">
          <Nav vertical="lg" pills className="justify-content-sm-start justify-content-center mb-3">
            {analytics.map((analytic, index) => (
              <NavLink key={analytic.name} active={activeTab === index} onClick={() => setActiveTab(index)} href="#">
                {analytic.name}
              </NavLink>
            ))}
          </Nav>
        </Col>
        <Col xs="12" lg="10" className="overflow-x">
          <Card>
            <CardBody>
              <ErrorBoundary>{analytics[activeTab].component(cards, cube, adds, cuts, loading)}</ErrorBoundary>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </CubeLayout>
  );
};

CubeAnalysisPage.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cubeID: PropTypes.string.isRequired,
  defaultFilterText: PropTypes.string,
};

CubeAnalysisPage.defaultProps = {
  defaultFilterText: '',
};

export default CubeAnalysisPage;
