import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Col, Nav, NavLink, Row } from 'reactstrap';

import Filter from './util/Filter';
import Hash from './util/Hash';

import AddAnalyticModal from './components/AddAnalyticModal';
import AddAnalyticModalContext from './components/AddAnalyticModalContext';
import AnalyticsTable from './components/AnalyticsTable';
import DynamicFlash from './components/DynamicFlash';
import ErrorBoundary from './components/ErrorBoundary';
import FilterCollapse from './components/FilterCollapse';

class CubeAnalysis extends Component {
  constructor(props) {
    super(props);

    this.nav = Hash.get('nav', 'colorCount'),
    this.state = {
      data: {type: "none"},
      workers: {},
      analytics: {
        colorCount: {url: '/js/analytics/colorCount.js', title: 'Count By Color'},
        cumulativeColorCount: {url: '/js/analytics/cumulativeColorCount.js', title: 'Cumulative Count By Color'}
      },
      analytics_order: ['colorCount', 'cumulativeColorCount'],
      filter: [],
      openCollapse: null
    };

    this.updateData = this.updateData.bind(this);
    this.setFilter = this.setFilter.bind(this);
    this.addScript = this.addScript.bind(this);
    this.setOpenCollapse = this.setOpenCollapse.bind(this);

    this.updateData();
  }

  addScript(scriptName, scriptKey, scriptCode) {
    const { analytics, analytics_order } = this.state;
    if (analytics[scriptKey]) {
        scriptName = scriptName + "-1";
        scriptKey = scriptKey + "-1";
    }
    const scriptBlob = new Blob([scriptCode], {type: 'application/json'});
    analytics[scriptKey] = {url: URL.createObjectURL(scriptBlob), title: scriptName};
    analytics_order.push(scriptKey);
    this.select(scriptKey);
  }

  select(nav) {
    Hash.set('nav', nav);
    this.nav = nav;
    this.updateData();
  }

  updateData() {
    const { workers, analytics, analytics_order, filter } = this.state;
    const { cube } = this.props;
    if (!workers[this.nav]) {
      if (analytics[this.nav]) workers[this.nav] = new Worker(analytics[this.nav].url);
      else {
        this.select(analytics_order[0]);
        return;
      }
      workers[this.nav].addEventListener("message", e => { this.setState({data: e.data})});
    }
    const worker = workers[this.nav];
    const cards = cube.cards;
    const filteredCards = filter.length > 0 ? cards.filter((card) => Filter.filterCard(card, filter)) : cards;
    worker.postMessage(filteredCards);
  }

  setFilter(filter) {
    this.setState({ filter });
    this.updateData();
  }
  
  setOpenCollapse(collapseFunction) {
    this.setState(({ openCollapse }) => ({
      openCollapse: collapseFunction(openCollapse),
    }));
  }

  render() {
    const { cube } = this.props;
    const { analytics, analytics_order, filter } = this.state
    const active = this.nav;
    const cards = cube.cards;
    const filteredCards = filter.length > 0 ? cards.filter((card) => Filter.filterCard(card, filter)) : cards;
    let navItem = (nav, text) => (
      <NavLink active={active === nav} onClick={this.select.bind(this, nav)} href="#" key={nav}>
        {text}
      </NavLink>
    );
    let visualization = (data) => {
      let result = (
        <p>Loading Data</p>
      );
      if (data) {
        if (data.type == 'table') result = (<AnalyticsTable data={this.state.data} title={analytics[active].title} />);
      }
      return result;
    }
            
    return (
      <AddAnalyticModal id="addAnalyticModal" addScript={this.addScript} setOpenCollapse={this.setOpenCollapse}>
        <DynamicFlash />
        <FilterCollapse
          filter={filter}
          setFilter={this.setFilter}
          numCards={filteredCards.length}
          isOpen={true}
        />
        <Row className="mt-3">
          <Col xs="12" lg="2">
            <Nav vertical="lg" pills className="justify-content-sm-start justify-content-center mb-3">
              {analytics_order.map((key) => navItem(key, analytics[key].title))}
              <AddAnalyticModalContext.Consumer>
                {(openAddAnalyticModal) => (
                  <NavLink active={false} onClick={openAddAnalyticModal}>
                    Add Custom Analytics Script
                  </NavLink>
                )}
              </AddAnalyticModalContext.Consumer>
            </Nav>
          </Col>
          <Col xs="12" lg="10">
            <ErrorBoundary>
              {visualization(this.state.data)}
            </ErrorBoundary>
          </Col>
        </Row>
      </AddAnalyticModal>
    );
  }
}

const cube = JSON.parse(document.getElementById('cube').value);
cube.cards.forEach((card, index) => {
  card.index = index;
});
const wrapper = document.getElementById('react-root');
const element = (
  <CubeAnalysis cube={cube} />
);
wrapper ? ReactDOM.render(element, wrapper) : false;
