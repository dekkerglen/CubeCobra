import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Nav, NavLink, Row } from 'reactstrap';

import CubeLayout from 'layouts/CubeLayout';

import CubeAnalysisNavBar from 'components/CubeAnalysisNavbar';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';

import Averages from 'analytics/Averages';
import Filter from 'utils/Filter';
import Chart from 'analytics/Chart';
import Tokens from 'analytics/Tokens';
import PivotTable from 'analytics/PivotTable';
import TagCloud from 'analytics/TagCloud';
import HyperGeom from 'analytics/HyperGeom';
import Asfans from 'analytics/Asfans';

const analytics = [
  {
    name: 'Averages',
    component: (cards) => <Averages cards={cards} />,
  },
  {
    name: 'Chart',
    component: (cards) => <Chart cards={cards} />,
  },
  {
    name: 'Asfans',
    component: (cards, cube) => <Asfans cards={cards} cube={cube} />,
  },
  {
    name: 'Tokens',
    component: (cards, cube) => <Tokens cards={cards} cube={cube} />,
  },
  {
    name: 'Tag Cloud',
    component: (cards) => <TagCloud cards={cards} />,
  },
  {
    name: 'Pivot Table',
    component: (cards) => <PivotTable cards={cards} />,
  },
  {
    name: 'Hypergeometric Calculator',
    component: (cards) => <HyperGeom cards={cards} />,
  },
];

const CubeAnalysisPage = ({ cube, cubeID, defaultFilterText }) => {
  const [filter, setFilter] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [cards, setCards] = useState(cube.cards);

  const updateFilter = (val) => {
    setFilter(val);
    setCards(cube.cards.filter((card) => Filter.filterCard(card, val)));
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
        <ErrorBoundary>{analytics[activeTab].component(cards, cube)}</ErrorBoundary>
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
