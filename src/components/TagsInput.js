import React, { Component } from 'react';
import ReactTags from 'react-tag-autocomplete';

class TagsInput extends Component {
  render() {
    console.log(this.props.tags);
    return <ReactTags tags={this.props.tags} suggestions={this.props.allTags} handleAddition={this.props.addTag} handleDelete={this.props.deleteTag} />;
  }
}

export default TagsInput;