import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

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

    const { defaultNav } = this.props;

    this.state = { activeNav: defaultNav };

    this.select = this.select.bind(this);
    this.handleNav = this.handleNav.bind(this);
  }

  componentDidMount() {
    const { nav } = this.state;
    this.setState({
      nav: Query.get('nav', nav),
    });
  }

  select(nav) {
    if (nav === 'curve') {
      Query.del('nav');
    } else {
      Query.set('nav', nav);
    }
    this.setState({ activeNav: nav });
  }

  handleNav(event) {
    event.preventDefault();
    this.select(event.target.getAttribute('data-nav'));
  }

  render() {
    const { cube, cubeID, curve, typeByColor, multicoloredCounts, tokens } = this.props;
    const { activeNav } = this.state;
    const navItem = (nav, text) => (
      <NavLink active={activeNav === nav} data-nav={nav} onClick={this.handleNav} href="#">
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
                }[activeNav]
              }
            </ErrorBoundary>
          </Col>
        </Row>
      </CubeLayout>
    );
  }
}

CubeAnalysis.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  curve: PropTypes.string.isRequired,
  typeByColor: PropTypes.shape({}).isRequired,
  multicoloredCounts: PropTypes.shape({}).isRequired,
  tokens: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.shape({}), PropTypes.arrayOf(PropTypes.shape({}))]))).isRequired,
  defaultNav: PropTypes.string,
};

CubeAnalysis.defaultProps = {
  defaultNav: 'curve',
};

const wrapper = document.getElementById('react-root');
const element = <CubeAnalysis {...window.reactProps} />;
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
