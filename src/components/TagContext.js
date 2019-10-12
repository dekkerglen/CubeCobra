import React, { Component } from 'react';

import { csrfFetch } from '../util/CSRF';

const TagContextRaw = React.createContext({
  addSuggestion: () => { console.error('Error: No TagContext!'); },
  allSuggestions: [],
});

class TagContextProvider extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tagColors: [...this.props.defaultTagColors],
      showTagColors: !!this.props.defaultShowTagColors,
      tags: [...(this.props.defaultTags || [])],
    };

    this.addTag = this.addTag.bind(this);
    this.setTagColors = this.setTagColors.bind(this);
    this.setShowTagColors = this.setShowTagColors.bind(this);
  }

  addTag(tag) {
    this.setState(({ tags }) =>
      tags.some(t => t.id === tag.id) ? {} : {
        tags: [...tags, tag],
      }
    );
  }

  setTagColors(tagColors) {
    const { cubeID } = this.props;
    return csrfFetch(`/cube/api/savetagcolors/${cubeID}`, {
      method: 'POST',
      body: JSON.stringify(tagColors),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => {
      if (response.ok) {
        this.setState({ tagColors });
      }
    });
  }

  setShowTagColors(showTagColors) {
    return csrfFetch('/cube/api/saveshowtagcolors', {
      method: 'POST',
      body: JSON.stringify({
        show_tag_colors: showTagColors,
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => {
      if (response.ok) {
        this.setState({ showTagColors });
      }
    });
  }

  render() {
    const { tags, tagColors, showTagColors } = this.state;
    const value = {
      allSuggestions: tags,
      addSuggestion: this.addTag,
      allTags: tags.map(tag => tag.text),
      tagColors,
      setTagColors: this.setTagColors,
      showTagColors,
      setShowTagColors: this.setShowTagColors,
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
  colors: [
    ['None', null],
    ['Red', 'red'],
    ['Brown', 'brown'],
    ['Orange', 'orange'],
    ['Yellow', 'yellow'],
    ['Green', 'green'],
    ['Turquoise', 'Turquoise'],
    ['Blue', 'blue'],
    ['Purple', 'purple'],
    ['Violet', 'violet'],
    ['Pink', 'pink'],
  ],
  getCardColorClass: card => {
    const type = card.type_line;
    const colors = card.colors;
    if (type.toLowerCase().includes('land')) {
      return 'lands';
    } else if (colors.length == 0) {
      return 'colorless';
    } else if (colors.length > 1) {
      return 'multi';
    } else if (colors.length == 1 && [...'WUBRGC'].includes(colors[0])) {
      return {
        'W': 'white',
        'U': 'blue',
        'B': 'black',
        'R': 'red',
        'G': 'green',
        'C': 'colorless',
      }[colors[0]];
    }
  },
  getCardTagColorClass: (tagColors, card) => {
    const tagColor = tagColors.find(({ tag }) => card.tags.includes(tag));
    if (tagColor) {
      return `tag-color tag-${tagColor.color}`;
    } else {
      return getCardColorClass(card);
    }
  },
  getTagColorClass: (tagColors, tag) => {
    const tagColor = tagColors.find(tagColor => tag === tagColor.tag);
    if (tagColor && tagColor.color) {
      return `tag-color tag-${tagColor.color}`;
    } else {
      return 'tag-no-color';
    }
  },
};

export default TagContext;
