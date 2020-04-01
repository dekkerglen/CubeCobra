import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Col, Nav, NavLink, Row } from 'reactstrap';

import CubeLayout from 'layouts/CubeLayout';

import Query from 'utils/Query';
import { getDraftFormat, calculateAsfans } from 'utils/draftutil';
import Filter from 'utils/Filter';

import CardGrid from 'components/analytics/CardGrid';
import Chart from 'components/analytics/Chart';
import Cloud from 'components/analytics/Cloud';
import AnalyticsTable from 'components/analytics/AnalyticsTable';
import CubeAnalysisNavBar from 'components/CubeAnalysisNavbar';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import MagicMarkdown from 'components/MagicMarkdown';

import averageCmc from 'analytics/averageCmc';
import colorCount from 'analytics/colorCount';
import colorCurve from 'analytics/colorCurve';
import inclusiveColorCount from 'analytics/inclusiveColorCount';
import tagCloud from 'analytics/tagCloud';
import tokenGrid from 'analytics/tokenGrid';
import typeBreakdown from 'analytics/typeBreakdown';
import typeBreakdownCount from 'analytics/typeBreakdownCount';

class CubeAnalysisPage extends Component {
  constructor(props) {
    super(props);

    const { defaultFormatId, defaultNav } = this.props;

    this.state = {
      data: { type: 'none' },
      analytics: {
        curve: { fn: colorCurve, title: 'Curve' },
        averageCmc: { fn: averageCmc, title: 'Average CMC' },
        typeBreakdown: { fn: typeBreakdown, title: 'Type Breakdown' },
        typeBreakdownCount: { fn: typeBreakdownCount, title: 'Type Breakdown Counts' },
        colorCount: { fn: colorCount, title: 'Color Counts' },
        inclusiveColorCount: { fn: inclusiveColorCount, title: 'Inclusive Color Counts' },
        tokenGrid: { fn: tokenGrid, title: 'Tokens' },
        tagCloud: { fn: tagCloud, title: 'Tag Cloud' },
      },
      analyticsOrder: [
        'curve',
        'averageCmc',
        'typeBreakdown',
        'typeBreakdownCount',
        'colorCount',
        'inclusiveColorCount',
        'tokenGrid',
        'tagCloud',
      ],
      filter: [],
      cardsWithAsfan: null,
      filteredWithAsfan: null,
      formatId: defaultFormatId || -1,
      nav: defaultNav || 'curve',
    };
    const { analytics, nav } = this.state;
    if (!analytics[nav]) {
      this.state.nav = 'curve';
    }

    this.updateAsfan = this.updateAsfan.bind(this);
    this.updateFilter = this.updateFilter.bind(this);
    this.updateData = this.updateData.bind(this);
    this.setFilter = this.setFilter.bind(this);
    this.toggleFormatDropdownOpen = this.toggleFormatDropdownOpen.bind(this);
    this.setFormat = this.setFormat.bind(this);
    this.handleNav = this.handleNav.bind(this);
  }

  componentDidMount() {
    this.updateAsfan();

    const { nav } = this.state;
    const newNav = Query.get('nav', nav);
    if (newNav !== nav) {
      this.handleNav(newNav);
    }
  }

  setFilter(filter) {
    this.setState({ filter }, this.updateFilter);
  }

  setFormat(formatId) {
    if (formatId === -1) {
      Query.del('formatId');
    } else {
      Query.set('formatId', formatId);
    }
    this.setState({ formatId }, this.updateAsfan);
  }

  async updateData() {
    const { nav, analytics, analyticsOrder, filteredWithAsfan } = this.state;
    if (filteredWithAsfan == null) {
      this.updateFilter();
      return;
    }

    if (analytics[nav]) {
      const data = await analytics[nav].fn(filteredWithAsfan);
      this.setState({ data });
    } else {
      this.handleNav(analyticsOrder[0]);
    }
  }

  async updateFilter() {
    const { filter, cardsWithAsfan } = this.state;
    if (cardsWithAsfan == null) {
      this.updateAsfan();
      return;
    }
    const filteredWithAsfan =
      filter.length > 0 ? cardsWithAsfan.filter((card) => Filter.filterCard(card, filter)) : cardsWithAsfan;
    this.setState({ filteredWithAsfan }, this.updateData);
  }

  async updateAsfan() {
    const { formatId } = this.state;
    const { cube } = this.props;
    const cardsWithAsfan = cube.cards.map((card) => ({ ...card }));
    const format = getDraftFormat({ id: formatId, packs: 3, cards: 15 }, cube);
    calculateAsfans(format, cardsWithAsfan);
    this.setState({ cardsWithAsfan }, this.updateFilter);
  }

  handleNav(nav) {
    const { analytics, analyticsOrder } = this.state;
    if (nav === analyticsOrder[0] || !analytics[nav]) {
      Query.del('nav');
      [nav] = analyticsOrder;
    } else {
      Query.set('nav', nav);
    }
    this.setState({ nav }, this.updateData);
  }

  toggleFormatDropdownOpen() {
    this.setState((prevState) => {
      return { formatDropdownOpen: !prevState.formatDropdownOpen };
    });
  }

  render() {
    const { cube, cubeID, defaultFilterText } = this.props;
    const { analytics, analyticsOrder, data, filter, formatId, nav, filteredWithAsfan } = this.state;
    const navItem = (active, text) => (
      <NavLink active={active === nav} onClick={() => this.handleNav(active)} href="#" key={active}>
        {text}
      </NavLink>
    );
    let visualization = <p>Loading Data</p>;
    if (data) {
      // Formats for data are documented in their respective components
      if (data.type === 'table') visualization = <AnalyticsTable data={data} />;
      else if (data.type === 'chart') visualization = <Chart data={data} />;
      else if (data.type === 'cloud') visualization = <Cloud data={data} />;
      else if (data.type === 'cardGrid') visualization = <CardGrid data={data} cube={cube} />;
    }
    return (
      <CubeLayout cube={cube} cubeID={cubeID} canEdit={false} activeLink="analysis">
        <DynamicFlash />
        <CubeAnalysisNavBar
          draftFormats={cube.draft_formats}
          formatId={formatId}
          setFormatId={this.setFormat}
          filter={filter}
          setFilter={this.setFilter}
          numCards={filteredWithAsfan ? filteredWithAsfan.length : 0}
          defaultFilterText={defaultFilterText}
        />
        <Row className="mt-3">
          <Col xs="12" lg="2">
            <Nav vertical="lg" pills className="justify-content-sm-start justify-content-center mb-3">
              {analyticsOrder.map((key) => navItem(key, analytics[key].title))}
            </Nav>
          </Col>
          <Col xs="12" lg="10">
            <Row>
              <Col>
                <h4 className="d-lg-block d-none">{analytics[nav].title}</h4>
                <p>
                  <MagicMarkdown markdown={data.description} cube={cube} />
                </p>
              </Col>
            </Row>
            <ErrorBoundary>{visualization}</ErrorBoundary>
          </Col>
        </Row>
      </CubeLayout>
    );
  }
}

CubeAnalysisPage.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cubeID: PropTypes.string.isRequired,
  defaultNav: PropTypes.string,
  defaultFormatId: PropTypes.number,
  defaultFilterText: PropTypes.string,
};

CubeAnalysisPage.defaultProps = {
  defaultNav: 'curve',
  defaultFormatId: -1,
  defaultFilterText: '',
};

export default CubeAnalysisPage;
