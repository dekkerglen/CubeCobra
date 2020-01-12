import React from 'react';

import ContentEditable from './ContentEditable';

import { Card, CardHeader, Input, Row } from 'reactstrap';

function clickToolbar(event) {
  event.preventDefault();
  const command = event.currentTarget.getAttribute('data-command');
  if (command == 'h5' || command == 'h6') {
    document.execCommand('formatBlock', false, command);
  } else if (command == 'AC') {
    card = /* global */ prompt('Enter the card name here: ', '');
    document.execCommand('insertHTML', false, "<a class='autocard', card='" + card + "'>" + card + '</a>');
    /* global */ autocard_init('autocard');
  } else document.execCommand(command, false, null);
}

const Toolbar = (props) => <div className="toolbar" {...props} />;
const ToolbarItem = (props) => <a href="#" className="toolbar-item" onClick={clickToolbar} {...props} />;

class TextEntry extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { name, value, onChange } = this.props;
    return (
      <Card>
        <CardHeader className="p-0">
          <Toolbar>
            <Row noGutters>
              <ToolbarItem data-command="bold">
                <strong>B</strong>
              </ToolbarItem>
              <ToolbarItem data-command="italic">
                <em>I</em>
              </ToolbarItem>
              <ToolbarItem data-command="underline">
                <u>U</u>
              </ToolbarItem>
              <ToolbarItem data-command="strikethrough">
                <s>S</s>
              </ToolbarItem>
              <ToolbarItem data-command="h5">
                <h5>H1</h5>
              </ToolbarItem>
              <ToolbarItem data-command="h6">
                <h6>H2</h6>
              </ToolbarItem>
              <ToolbarItem data-command="insertUnorderedList">ul</ToolbarItem>
              <ToolbarItem data-command="insertOrderedList">ol</ToolbarItem>
            </Row>
          </Toolbar>
        </CardHeader>
        <ContentEditable className="text-entry" value={value} onChange={onChange} />
        <Input type="hidden" name={name} value={value} />
      </Card>
    );
  }
}

export default TextEntry;
