import React from 'react';
import PropTypes from 'prop-types';

import { Card, FormGroup, FormText, Input, Label } from 'reactstrap';

import TextEntry from 'components/TextEntry';

const BlogpostEditor = ({ name, value, onChange }) => (
  <>
    <h6>Blog Post</h6>
    <FormGroup>
      <Label className="sr-only">Blog Title</Label>
      <Input type="text" name="title" defaultValue="Cube Updated – Automatic Post" />
    </FormGroup>
    <FormGroup>
      <Label className="sr-only">Blog Body</Label>
      <Card>
        <TextEntry name={name} value={value} onChange={onChange} />
      </Card>
      <FormText>
        Having trouble formatting your posts? Check out the <a href="/markdown">markdown guide</a>.
      </FormText>
    </FormGroup>
  </>
);

BlogpostEditor.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default BlogpostEditor;
