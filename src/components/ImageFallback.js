import React, { Component } from 'react';

class ImageFallback extends Component {
  constructor(props) {
    super(props);

    this.state = {
      fallback: false,
      foilOverlayBorderRadius: '10px',
    };

    this.foilOverlay = React.createRef();
    this.handleError = this.handleError.bind(this);
  }

  componentDidMount() {
    this.setState({ foilOverlayBorderRadius: (3 / 63) * this.foilOverlay.current.width });
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
    return (
      <div style={{ position: 'relative' }}>
        <img
          hidden={this.props.finish !== 'Foil'}
          src="/content/foilOverlay.png"
          className="foilOverlay"
          ref={this.foilOverlay}
          style={{ borderRadius: this.state.foilOverlayBorderRadius }}
        />
        {cardImage}
      </div>
    );
  }
}

export default ImageFallback;
