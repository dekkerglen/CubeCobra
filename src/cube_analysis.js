import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Col, Container, Dropdown, DropdownMenu, DropdownToggle, DropdownItem, Nav, NavLink, Row } from 'reactstrap';

import { getDraftFormat, calculateAsfans } from './util/draftutil';
import Filter from './util/Filter';
import Hash from './util/Hash';

import AnalyticsBarChart from './components/AnalyticsBarChart';
import AnalyticsCardGrid from './components/AnalyticsCardGrid';
import AnalyticsCloud from './components/AnalyticsCloud';
import AnalyticsTable from './components/AnalyticsTable';
import DynamicFlash from './components/DynamicFlash';
import ErrorBoundary from './components/ErrorBoundary';
import FilterCollapse from './components/FilterCollapse';
import MagicMarkdown from './components/MagicMarkdown';

class CubeAnalysis extends Component {
  constructor(props) {
    super(props);

    this.state = {
      nav: Hash.get('nav', 'curve'),
      data: { type: 'none' },
      workers: {},
      analytics: {
        curve: { url: '/js/analytics/colorCurve.js', title: 'Curve' },
        typeBreakdown: { url: '/js/analytics/typeBreakdown.js', title: 'Type Breakdown' },
        colorCount: { url: '/js/analytics/colorCount.js', title: 'Color Counts' },
        tokenGrid: { url: '/js/analytics/tokenGrid.js', title: 'Tokens' },
        tagCloud: { url: '/js/analytics/tagCloud.js', title: 'Tag Cloud' },
        cumulativeColorCount: { url: '/js/analytics/cumulativeColorCount.js', title: 'Cumulative Color Counts' },
      },
      analytics_order: ['curve', 'typeBreakdown', 'colorCount', 'tokenGrid', 'tagCloud', 'cumulativeColorCount'],
      filter: [],
      cardsWithAsfan: null,
      filteredWithAsfan: null,
      formatId: Hash.get('formatId', -1),
      formatDropdownOpen: false,
    };

    this.updateAsfan = this.updateAsfan.bind(this);
    this.updateFilter = this.updateFilter.bind(this);
    this.updateData = this.updateData.bind(this);
    this.setFilter = this.setFilter.bind(this);
    this.toggleFormatDropdownOpen = this.toggleFormatDropdownOpen.bind(this);
    this.setFormat = this.setFormat.bind(this);
  }

  componentDidMount() {
    this.updateAsfan();
  }

  select(nav) {
    Hash.set('nav', nav);
    this.setState({ nav }, this.updateData);
  }

  async updateAsfan() {
    const { formatId } = this.state;
    const { cube } = this.props;
    const cardsWithAsfan = cube.cards.map((card) => Object.assign({}, card));
    const format = getDraftFormat({ id: formatId }, cube);
    calculateAsfans(format, cardsWithAsfan);
    this.setState({ cardsWithAsfan }, this.updateFilter);
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
        this.select(analytics_order[0]);
        return;
      }
    }
    workers[nav].postMessage(filteredWithAsfan);
  }

  setFilter(filter) {
    this.setState({ filter }, this.updateFilter);
  }

  setFormat(formatId) {
    Hash.set('formatId', formatId);
    this.setState({ formatId }, this.updateAsfan);
  }

  toggleFormatDropdownOpen() {
    this.setState((prevState, props) => {
      return { formatDropdownOpen: !prevState.formatDropdownOpen };
    });
  }

  render() {
    const { cube } = this.props;
    const { analytics, analytics_order, data, filter, formatDropdownOpen, formatId, nav } = this.state;
    const cards = cube.cards;
    const filteredCards =
      (filter && filter.length) > 0 ? cards.filter((card) => Filter.filterCard(card, filter)) : cards;
    let navItem = (active, text) => (
      <NavLink active={active === nav} onClick={this.select.bind(this, active)} href="#" key={active}>
        {text}
      </NavLink>
    );
    let visualization = <p>Loading Data</p>;
    if (data) {
      // Formats for data are documented in their respective components
      if (data.type == 'table') visualization = <AnalyticsTable data={data} />;
      else if (data.type == 'chart') visualization = <AnalyticsBarChart data={data} />;
      else if (data.type == 'cloud') visualization = <AnalyticsCloud data={data} />;
      else if (data.type == 'cardGrid') visualization = <AnalyticsCardGrid data={data} cube={cube} />;
    }

    let dropdownElement = <h5>Default Draft Format</h5>;
    if (cube.draft_formats) {
      dropdownElement = (
        <Row>
          <Col>
            <h5>{formatId >= 0 ? cube.draft_formats[formatId].title : 'Default Draft Format'}</h5>
          </Col>
          <Col>
            <Dropdown isOpen={formatDropdownOpen} toggle={this.toggleFormatDropdownOpen}>
              <DropdownToggle caret>Change Draft Format</DropdownToggle>
              <DropdownMenu>
                <DropdownItem key="default" onClick={() => this.setFormat(-1)}>
                  Default Draft Format
                </DropdownItem>
                <DropdownItem header key="customformatsheader">
                  Custom Formats
                </DropdownItem>
                {cube.draft_formats
                  ? cube.draft_formats.map((format, formatIndex) => (
                      <DropdownItem key={format} onClick={() => this.setFormat(formatIndex)}>
                        {format.title}
                      </DropdownItem>
                    ))
                  : ''}
              </DropdownMenu>
            </Dropdown>
          </Col>
        </Row>
      );
    }
    return (
      <>
        <DynamicFlash />
        <FilterCollapse filter={filter} setFilter={this.setFilter} numCards={filteredCards.length} isOpen={true} />
        {dropdownElement}
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
      </>
    );
  }
}

const cube = JSON.parse(document.getElementById('cube').value);
cube.cards.forEach((card, index) => {
  card.index = index;
});
const wrapper = document.getElementById('react-root');
const element = <CubeAnalysis cube={cube} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
