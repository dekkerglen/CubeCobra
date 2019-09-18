/* Holds general display settings. */
/* Should eventually hold tag colors, etc. */

import React, { Component } from 'react';

const DisplayContextRaw = React.createContext({
  showCustomImages: true,
  tagColors: [],
});

class DisplayContextProvider extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      showCustomImages: true,
      showTagColors: /* global */ show_tag_colors,
      tagColors: /* global */ cubeTagColors,
    };

    this.toggleShowCustomImages = this.toggleShowCustomImages.bind(this);

    /* global */
    tagColorsListeners.push(() => this.setState({
      showTagColors: /* global */ show_tag_colors,
      tagColors: /* global */ cubeTagColors,
    }));
  }

  toggleShowCustomImages(value) {
    this.setState(({ showCustomImages }) => ({
      showCustomImages: !showCustomImages,
    }));
  }

  render() {
    const value = {
      ...this.state,
      toggleShowCustomImages: this.toggleShowCustomImages,
    };
    return (
      <DisplayContextRaw.Provider value={value} {...this.props} />
    );
  }
}

const DisplayContext = {
  Provider: DisplayContextProvider,
  Consumer: DisplayContextRaw.Consumer,
  Wrapped: Component => props => (
    <DisplayContextRaw.Consumer>
      { value => <Component {...value} {...props} /> }
    </DisplayContextRaw.Consumer>
  ),
};

export default DisplayContext;
