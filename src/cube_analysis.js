import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { Col, Nav, NavLink, Row } from 'reactstrap';

import CubeLayout from 'layouts/CubeLayout';

import Query from 'utils/Query';

import { getDraftFormat, calculateAsfans } from 'utils/draftutil';
import Filter from 'utils/Filter';

import AnalyticsCardGrid from 'components/AnalyticsCardGrid';
import AnalyticsChart from 'components/AnalyticsChart';
import AnalyticsCloud from 'components/AnalyticsCloud';
import AnalyticsTable from 'components/AnalyticsTable';
import CubeAnalysisNavBar from 'components/CubeAnalysisNavbar';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import MagicMarkdown from 'components/MagicMarkdown';

class CubeAnalysis extends Component {
  constructor(props) {
    super(props);

    const { defaultFormatId, defaultNav } = this.props;

    this.state = {
      data: { type: 'none' },
      workers: {},
      analytics: {
        curve: { url: '/js/analytics/colorCurve.js', title: 'Curve' },
        averageCmc: { url: '/js/analytics/averageCmc.js', title: 'Average CMC' },
        typeBreakdown: { url: '/js/analytics/typeBreakdown.js', title: 'Type Breakdown' },
        typeBreakdownCounts: { url: '/js/analytics/typeBreakdownCount.js', title: 'Type Breakdown Counts' },
        colorCount: { url: '/js/analytics/colorCount.js', title: 'Color Counts' },
        cumulativeColorCount: { url: '/js/analytics/cumulativeColorCount.js', title: 'Cumulative Color Counts' },
        tokenGrid: { url: '/js/analytics/tokenGrid.js', title: 'Tokens' },
        tagCloud: { url: '/js/analytics/tagCloud.js', title: 'Tag Cloud' },
      },
      analytics_order: [
        'curve',
        'averageCmc',
        'typeBreakdown',
        'typeBreakdownCounts',
        'colorCount',
        'cumulativeColorCount',
        'tokenGrid',
        'tagCloud',
      ],
      filter: [],
      cardsWithAsfan: null,
      filteredWithAsfan: null,
      formatId: defaultFormatId || -1,
      nav: defaultNav || 'curve',
    };

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
    this.setState({
      nav: Query.get('nav', nav),
    });
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
    const { nav, workers, analytics, analytics_order, filteredWithAsfan } = this.state;
    if (filteredWithAsfan == null) {
      this.updateFilter();
      return;
    }
    if (!workers[nav]) {
      if (analytics[nav]) {
        workers[nav] = new Worker(analytics[nav].url);
        workers[nav].addEventListener('message', (e) => {
          this.setState({ data: e.data });
        });
      } else {
        this.handleNav(analytics_order[0]);
        return;
      }
    }
    workers[nav].postMessage(filteredWithAsfan);
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
    if (nav === 'curve') {
      Query.del('nav');
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
    const { analytics, analytics_order, data, filter, formatId, nav, filteredWithAsfan } = this.state;
    const navItem = (active, text) => (
      <NavLink active={active === nav} onClick={() => this.handleNav(active)} href="#" key={active}>
        {text}
      </NavLink>
    );
    let visualization = <p>Loading Data</p>;
    if (data) {
      // Formats for data are documented in their respective components
      if (data.type === 'table') visualization = <AnalyticsTable data={data} />;
      else if (data.type === 'chart') visualization = <AnalyticsChart data={data} />;
      else if (data.type === 'cloud') visualization = <AnalyticsCloud data={data} />;
      else if (data.type === 'cardGrid') visualization = <AnalyticsCardGrid data={data} cube={cube} />;
    }
    return (
      <CubeLayout cube={cube} cubeID={cubeID} canEdit={false} activeLink="playtest">
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
              {analytics_order.map((key) => navItem(key, analytics[key].title))}
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

CubeAnalysis.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cubeID: PropTypes.string.isRequired,
  defaultNav: PropTypes.string,
  defaultFormatId: PropTypes.number,
  defaultFilterText: PropTypes.string,
};

CubeAnalysis.defaultProps = {
  defaultNav: 'curve',
  defaultFormatId: -1,
  defaultFilterText: '',
};

const wrapper = document.getElementById('react-root');
const element = <CubeAnalysis {...window.reactProps} />;
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
