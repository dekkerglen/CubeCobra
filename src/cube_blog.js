import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Col, Nav, NavLink, Row } from 'reactstrap';


class CubeBlog extends Component {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  select(nav) {
    this.setState({ });
  }

  render() {
      
  }
}

const wrapper = document.getElementById('react-root');
const element = <CubeBlog />;
wrapper ? ReactDOM.render(element, wrapper) : false;
