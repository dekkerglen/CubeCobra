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
      primary: document.getElementById('primarySortSelect').value || 'Color Category',
      secondary: document.getElementById('secondarySortSelect').value || 'Types-Multicolor',
      tertiary: 'CMC2',
    };
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

  render() {
    return (
      <SortContextRaw.Provider value={this.state} {...this.props} />
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
