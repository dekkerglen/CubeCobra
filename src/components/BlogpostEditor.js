import React from 'react';

import { Card, CardHeader, Col, FormGroup, FormText, Input, Label, Row } from 'reactstrap';

import ContentEditable from './ContentEditable';

const Toolbar = (props) => <div className="toolbar" {...props} />;
const ToolbarItem = (props) => <a href="#" className="toolbar-item" onClick={clickToolbar} {...props} />;

const clickToolbar = (event) => {
  event.preventDefault();
  const command = event.currentTarget.getAttribute('data-command');
  if (command == 'h5' || command == 'h6') {
    document.execCommand('formatBlock', false, command);
  } else if (command == 'AC') {
    card = /* global */ prompt('Enter the card name here: ', '');
    document.execCommand('insertHTML', false, "<a class='autocard', card='" + card + "'>" + card + '</a>');
    /* global */ autocard_init('autocard');
  } else document.execCommand(command, false, null);
};

const BlogpostEditor = ({ name, value, onChange, ...props }) => (
  <>
    <h6>Blog Post</h6>
    <FormGroup>
      <Label className="sr-only">Blog Title</Label>
      <Input type="text" name="title" defaultValue="Cube Updated – Automatic Post" />
    </FormGroup>
    <FormGroup>
      <Label className="sr-only">Blog Body</Label>
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
        <ContentEditable className="blogpost-editor" value={value} onChange={onChange} />
        <Input type="hidden" name={name} value={value} />
      </Card>
      <FormText>To tag cards in post, use '[[cardname]]'. E.g. [[Island]]</FormText>
    </FormGroup>
  </>
);

export default BlogpostEditor;
