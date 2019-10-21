/* Encapsulates the as-yet-unmanaged sorting behavior for cube lists. */

import React, { Component } from 'react';

const SortContextRaw = React.createContext({
  primary: 'Color Category',
  secondary: 'Types-Multicolor',
  tertiary: 'CMC2',
});

class SortContextProvider extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      primary: document.getElementById('sort1').value || 'Color Category',
      secondary: document.getElementById('sort2').value || 'Types-Multicolor',
      tertiary: 'CMC2',
    };

    this.changeSort = this.changeSort.bind(this);
  }

  componentDidMount() {
    for (const stage of ['primary', 'secondary']) {
      const select = document.getElementById(`${stage}SortSelect`);
      if (!select) continue;
      select.addEventListener('change', event => {
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
    return (
      <SortContextRaw.Provider value={value} {...this.props} />
    );
  }
}

const SortContext = {
  Provider: SortContextProvider,
  Consumer: SortContextRaw.Consumer,
  Wrapped: Component => props => (
    <SortContextRaw.Consumer>
      { value => <Component {...value} {...props} /> }
    </SortContextRaw.Consumer>
  ),
};

export default SortContext;
