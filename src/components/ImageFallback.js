import React, { Component } from 'react';

class ImageFallback extends Component {
  constructor(props) {
    super(props);

    this.state = {
      fallback: false,
    };

    this.handleError = this.handleError.bind(this);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.src !== this.props.src) {
      this.setState({ fallback: false });
    }
  }

  handleError(event) {
    this.setState({ fallback: true });
  }

  render() {
    const { src, fallbackSrc, ...props } = this.props;
    const cardImage = <img src={this.state.fallback ? fallbackSrc : src} onError={this.handleError} {...props} />;
    if (this.props.finish === 'Foil') {
      return (
        <div style={{position: 'relative'}}>
          <img
            src="/content/foilOverlay.png"
            style={{position: 'absolute', height: '100%', width: '100%', borderRadius: '10px'}}
          />
          {cardImage}
        </div>
      );
    } else {
      return cardImage;
    }
  }
}

export default ImageFallback;
