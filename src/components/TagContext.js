import React, { Component } from 'react';

import { csrfFetch } from '../util/CSRF';

const TagContextRaw = React.createContext({
  addSuggestion: () => {
    console.error('Error: No TagContext!');
  },
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

    window.globalTagColors = this.props.defaultTagColors;
    window.globalShowTagColors = !!this.props.defaultShowTagColors;

    this.addTag = this.addTag.bind(this);
    this.setTagColors = this.setTagColors.bind(this);
    this.setShowTagColors = this.setShowTagColors.bind(this);
    this.cardColorClass = this.cardColorClass.bind(this);
    this.tagColorClass = this.tagColorClass.bind(this);
  }

  addTag(tag) {
    this.setState(({ tags }) =>
      tags.some((t) => t.id === tag.id)
        ? {}
        : {
            tags: [...tags, tag],
          },
    );
  }

  setTagColors(tagColors) {
    const { cubeID } = this.props;
    return csrfFetch(`/cube/api/savetagcolors/${cubeID}`, {
      method: 'POST',
      body: JSON.stringify(tagColors),
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((response) => {
      if (response.ok) {
        this.setState({ tagColors });
        window.globalTagColors = tagColors;
      } else {
        console.error('Request failed.');
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
        'Content-Type': 'application/json',
      },
    }).then((response) => {
      if (response.ok) {
        this.setState({ showTagColors });
        window.globalShowTagColors = showTagColors;
      } else {
        console.error('Request failed.');
      }
    });
  }

  cardColorClass(card) {
    if (this.state.showTagColors) {
      return getCardTagColorClass(this.state.tagColors, card);
    } else {
      return getCardColorClass(card);
    }
  }

  tagColorClass(tag) {
    if (this.state.showTagColors) {
      return getTagColorClass(this.state.tagColors, tag);
    } else {
      return 'tag-no-color';
    }
  }

  render() {
    const { tags, tagColors, showTagColors } = this.state;
    const value = {
      allSuggestions: tags,
      addSuggestion: this.addTag,
      allTags: tags.map((tag) => tag.text),
      tagColors,
      setTagColors: this.setTagColors,
      showTagColors,
      setShowTagColors: this.setShowTagColors,
      cardColorClass: this.cardColorClass,
      tagColorClass: this.tagColorClass,
    };
    return <TagContextRaw.Provider value={value}>{this.props.children}</TagContextRaw.Provider>;
  }
}

export const getCardColorClass = (card) => {
  const type = card.type_line || card.details.type;
  const colors = card.colors || card.details.color_identity;
  if (type.toLowerCase().includes('land')) {
    return 'lands';
  } else if (colors.length == 0) {
    return 'colorless';
  } else if (colors.length > 1) {
    return 'multi';
  } else if (colors.length == 1 && [...'WUBRGC'].includes(colors[0])) {
    return {
      W: 'white',
      U: 'blue',
      B: 'black',
      R: 'red',
      G: 'green',
      C: 'colorless',
    }[colors[0]];
  }
};

export const getCardTagColorClass = (tagColors, card) => {
  const tagColor = tagColors.find(({ tag }) => card.tags.includes(tag));
  if (tagColor && tagColor.color) {
    return `tag-color tag-${tagColor.color}`;
  } else {
    return getCardColorClass(card);
  }
};

export const getTagColorClass = (tagColors, tag) => {
  const tagColor = tagColors.find((tagColor) => tag === tagColor.tag);
  if (tagColor && tagColor.color) {
    return `tag-color tag-${tagColor.color}`;
  } else {
    return 'tag-no-color';
  }
};

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
    ['Turquoise', 'turquoise'],
    ['Blue', 'blue'],
    ['Purple', 'purple'],
    ['Violet', 'violet'],
    ['Pink', 'pink'],
  ],
  getCardColorClass,
  getCardTagColorClass,
  getTagColorClass,
};

export default TagContext;
