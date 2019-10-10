import React, { Component } from 'react';

const TagContextRaw = React.createContext({
  addSuggestion: () => { console.error('Error: No TagContext!'); },
  allSuggestions: [],
});

class TagContextProvider extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tags: [...(this.props.defaultTags || [])],
    };

    this.addTag = this.addTag.bind(this);
  }

  addTag(tag) {
    this.setState(({ tags }) =>
      tags.some(t => t.id === tag.id) ? {} : {
        tags: [...tags, tag],
      }
    );
  }

  render() {
    const value = {
      allSuggestions: this.state.tags,
      addSuggestion: this.addTag,
    };
    return (
      <TagContextRaw.Provider value={value}>
        {this.props.children}
      </TagContextRaw.Provider>
    );
  }
}

const TagContext = {
  Provider: TagContextProvider,
  Consumer: TagContextRaw.Consumer,
};

export default TagContext;
