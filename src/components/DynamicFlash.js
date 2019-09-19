import React, { Component } from 'react';

import { UncontrolledAlert } from 'reactstrap';

const colorMap = {
  info: 'info',
  alert: 'alert',
  error: 'danger',
};

class DynamicFlash extends Component {
  constructor(props) {
    super(props);

    const flashInput = document.getElementById('flash');
    const flashValue = flashInput ? flashInput.value : '[]';
    this.state = {
      messages: JSON.parse(flashValue),
    };
  }

  render() {
    return <>
      {[].concat.apply([], Object.keys(this.state.messages).map(type =>
        this.state.messages[type].map((message, index) =>
          <UncontrolledAlert className="mb-0 mt-3" key={type + index} color={type}>{message}</UncontrolledAlert>
        )
      ))}
    </>;
  }
}

export default DynamicFlash;
