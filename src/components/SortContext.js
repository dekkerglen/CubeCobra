/* Encapsulates the as-yet-unmanaged sorting behavior for cube lists. */

import React, { Component } from 'react';

const SortContext = React.createContext({
  primary: 'Color Category',
  secondary: 'Types-Multicolor',
  tertiary: 'CMC2',
});

export class SortContextProvider extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      primary: this.props.defaultSorts[0] || 'Color Category',
      secondary: this.props.defaultSorts[1] || 'Types-Multicolor',
      tertiary: 'CMC2',
    };

    this.changeSort = this.changeSort.bind(this);
  }

  componentDidMount() {
    for (const stage of ['primary', 'secondary']) {
      const select = document.getElementById(`${stage}SortSelect`);
      if (!select) continue;
      select.addEventListener('change', (event) => {
        this.setState({
          [stage]: event.target.value,
        });
      });
    }
  }

  changeSort(change) {
    this.setState(change);
  }

  render() {
    const value = {
      ...this.state,
      changeSort: this.changeSort,
    };
    return <SortContext.Provider value={value} {...this.props} />;
  }
}

SortContext.Wrapped = (Tag) => (props) =>
  <SortContext.Consumer>
    {(value) =>
      <Tag {...props} {...value} />
    }
  </SortContext.Consumer>;

export default SortContext;
