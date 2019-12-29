import React, { Component } from 'react';

class ContentEditable extends Component {
  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);

    this.elementRef = React.createRef();
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.value !== this.elementRef.current.innerHTML;
  }

  componentDidUpdate() {
    if (this.props.value !== this.elementRef.current.innerHTML) {
      this.elementRef.current.innerHTML = this.props.value;
    }
  }

  handleChange(event) {
    if (this.props.onChange) {
      this.props.onChange({
        target: {
          value: event.target.innerHTML,
        },
      });
    }
  }

  render() {
    const { onChange, value, ...props } = this.props;
    return (
      <div
        contentEditable
        onInput={this.handleChange}
        onBlur={this.handleChange}
        dangerouslySetInnerHTML={{ __html: value }}
        ref={this.elementRef}
        {...props}
      />
    );
  }
}

export default ContentEditable;
