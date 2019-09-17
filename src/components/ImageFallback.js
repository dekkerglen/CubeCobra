import React, { Component } from 'react';

class ImageFallback extends Component {
  constructor(props) {
    super(props);

    this.state = {
      fallback: false,
    }

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

    return (
      <img src={this.state.fallback ? fallbackSrc : src} onError={this.handleError} {...props} />
    );
  }
}

export default ImageFallback;
