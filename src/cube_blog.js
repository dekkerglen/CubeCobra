import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Col, Nav, NavLink, Row } from 'reactstrap';


class CubeBlog extends Component {
  constructor(props) {
    super(props);

    this.state = {
        posts: this.props.posts,
        pages: this.props.pages
      };
  }

  select(nav) {
    this.setState({ });
  }

  render() {
      return (
        <>
            <hr/>
            <hr/>
            <hr/>
            <hr/>
        </>
      );
  }
}

const posts = JSON.parse(document.getElementById('blogData').value);
const pages = JSON.parse(document.getElementById('blogPages').value);
const wrapper = document.getElementById('react-root');
const element = <CubeBlog posts={posts} pages={pages} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
