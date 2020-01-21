import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Col, Nav, NavLink, Row } from 'reactstrap';

import Query from 'utils/Query';

import CurveAnalysis from 'components/CurveAnalysis';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import MulticoloredAnalysis from 'components/MulticoloredAnalysis';
import TypeAnalysis from 'components/TypeAnalysis';
import TokenAnalysis from 'components/TokenAnalysis';
import CubeLayout from 'layouts/CubeLayout';

class CubeAnalysis extends Component {
  constructor(props) {
    super(props);

    this.state = {
      nav: this.props.defaultNav || 'curve',
    };
  }

  componentDidMount() {
    this.setState({
      nav: Query.get('nav', this.state.nav),
    });
  }

  select(nav) {
    if (nav === 'curve') {
      Query.del('nav');
    } else {
      Query.set('nav', nav);
    }
    this.setState({ nav });
  }

  render() {
    const { cube, cubeID, curve, typeByColor, multicoloredCounts, tokens } = this.props;
    const active = this.state.nav;
    let navItem = (nav, text) => (
      <NavLink active={active === nav} onClick={this.select.bind(this, nav)} href="#">
        {text}
      </NavLink>
    );
    return (
      <CubeLayout cube={cube} cubeID={cubeID} canEdit={false}>
        <DynamicFlash />
        <Row className="mt-3">
          <Col xs="12" lg="2">
            <Nav vertical="lg" pills className="justify-content-sm-start justify-content-center mb-3">
              {navItem('curve', 'Curve')}
              {navItem('type', 'Type Breakdown')}
              {navItem('multi', 'Multicolored Counts')}
              {navItem('tokens', 'Tokens')}
            </Nav>
          </Col>
          <Col xs="12" lg="10">
            <ErrorBoundary>
              {
                {
                  curve: <CurveAnalysis curve={curve} />,
                  type: <TypeAnalysis typeByColor={typeByColor} />,
                  multi: <MulticoloredAnalysis multicoloredCounts={multicoloredCounts} />,
                  tokens: <TokenAnalysis tokens={tokens} />,
                }[active]
              }
            </ErrorBoundary>
          </Col>
        </Row>
      </CubeLayout>
    );
  }
}

const wrapper = document.getElementById('react-root');
const element = <CubeAnalysis {...reactProps} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
