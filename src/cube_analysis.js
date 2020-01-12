import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Col, Container, Dropdown, DropdownMenu, DropdownToggle, DropdownItem, Nav, NavLink, Row } from 'reactstrap';

import Filter from './util/Filter';
import Hash from './util/Hash';

import AnalyticsBarChart from './components/AnalyticsBarChart';
import AnalyticsCardGrid from './components/AnalyticsCardGrid';
import AnalyticsCloud from './components/AnalyticsCloud';
import AnalyticsTable from './components/AnalyticsTable';
import DynamicFlash from './components/DynamicFlash';
import ErrorBoundary from './components/ErrorBoundary';
import FilterCollapse from './components/FilterCollapse';

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
    this.updateAsfanCustomWithMultiples = this.updateAsfanCustomWithMultiples.bind(this);
    this.updateAsfanCustomSingleton = this.updateAsfanCustomSingleton.bind(this);
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

  updateAsfanCustomWithMultiples(format, cardsWithAsfan, pools) {
    var failMessage = null;
    for (var i = 0; i < format.length; i++) {
      for (var j = 0; j < format[i].length; j++) {
        const tagCount = format[i][j].length;
        for (var tag of format[i][j]) {
          const pool = pools[tag];
          if (pool && pool.length > 0) {
            const poolWeight = 1 / tagCount / pool.length;
            for (var cardIndex of pool) {
              cardsWithAsfan[cardIndex].asfan += poolWeight;
            }
          } else {
            failMessage = 'Unable to create draft, no card with tag "' + tag + '" found.';
          }
        }
      }
    }
    if (!failMessage) {
      this.setState({ cardsWithAsfan }, this.updateFilter);
    } else {
      console.error(failMessage);
    }
  }

  updateAsfanCustomSingleton(format, cardsWithAsfan, pools) {
    var failMessage = null;
    for (var i = 0; i < format.length; i++) {
      for (var j = 0; j < format[i].length; j++) {
        const tagCount = format[i][j].length;
        for (var tag of format[i][j]) {
          const pool = pools[tag];
          if (pool && pool.length > 0) {
            const poolCount = pool.reduce((sum, cardIndex) => sum + (1 - cardsWithAsfan[cardIndex].asfan), 0);
            const poolWeight = 1 / tagCount / poolCount;
            for (var cardIndex of pool) {
              cardsWithAsfan[cardIndex].asfan += (1 - cardsWithAsfan[cardIndex].asfan) * poolWeight;
            }
          } else {
            failMessage = 'Unable to create draft, no card with tag "' + tag + '" found.';
          }
        }
      }
    }
    if (!failMessage) {
      this.setState({ cardsWithAsfan }, this.updateFilter);
    } else {
      console.error(failMessage);
    }
  }

  async updateAsfan() {
    const { formatId } = this.state;
    const { cube } = this.props;
    if (formatId == -1) {
      const defaultAsfan = 15 / cube.cards.length;
      const cardsWithAsfan = cube.cards.map((card) => Object.assign({}, card, { asfan: defaultAsfan }));
      this.setState({ cardsWithAsfan }, this.updateFilter);
    } else {
      var format = JSON.parse(cube.draft_formats[formatId].packs);
      for (var j = 0; j < format.length; j++) {
        for (var k = 0; k < format[j].length; k++) {
          format[j][k] = format[j][k].split(',');
          for (var m = 0; m < format[j][k].length; m++) {
            format[j][k][m] = format[j][k][m].trim().toLowerCase();
          }
        }
      }
      var pools = {};
      const cards = cube.cards;
      //sort the cards into groups by tag, then we can pull from them randomly
      pools['*'] = [];
      cards.forEach(function(card, index) {
        pools['*'].push(index);
        if (card.tags && card.tags.length > 0) {
          card.tags.forEach(function(tag, tag_index) {
            tag = tag.toLowerCase();
            if (tag != '*') {
              if (!pools[tag]) {
                pools[tag] = [];
              }
              if (!pools[tag].includes(index)) {
                pools[tag].push(index);
              }
            }
          });
        }
      });
      var cardsWithAsfan = cards.map((card) => Object.assign({}, card, { asfan: 0 }));
      if (cube.draft_formats[formatId].multiples) {
        this.updateAsfanCustomWithMultiples(format, cardsWithAsfan, pools);
      } else {
        this.updateAsfanCustomSingleton(format, cardsWithAsfan, pools);
      }
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
    const { analytics, analytics_order, filter, formatDropdownOpen, formatId } = this.state;
    const active = this.state.nav;
    const cards = cube.cards;
    const filteredCards =
      (filter && filter.length) > 0 ? cards.filter((card) => Filter.filterCard(card, filter)) : cards;
    let navItem = (nav, text) => (
      <NavLink active={active === nav} onClick={this.select.bind(this, nav)} href="#" key={nav}>
        {text}
      </NavLink>
    );
    let visualization = (data) => {
      if (data) {
        if (data.type == 'table') return <AnalyticsTable data={this.state.data} title={analytics[active].title} />;
        else if (data.type == 'bar')
          return <AnalyticsBarChart data={this.state.data} title={analytics[active].title} />;
        else if (data.type == 'cloud') return <AnalyticsCloud data={this.state.data} title={analytics[active].title} />;
        else if (data.type == 'cardGrid')
          return <AnalyticsCardGrid data={this.state.data} title={analytics[active].title} cube={cube} />;
      }
      return <p>Loading Data</p>;
    };
    var dropdownElement;
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
    } else {
      dropdownElement = <h5>Default Draft Format</h5>;
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
            <ErrorBoundary>{visualization(this.state.data)}</ErrorBoundary>
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
