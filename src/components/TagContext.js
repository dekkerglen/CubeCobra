import React, { Component } from 'react';

import { csrfFetch } from '../utils/CSRF';

const TagContext = React.createContext({
  addSuggestion: () => {
    console.error('Error: No TagContext!');
  },
  allSuggestions: [],
});

export class TagContextProvider extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tagColors: this.props.defaultTagColors ? [...this.props.defaultTagColors] : [],
      showTagColors: !!this.props.defaultShowTagColors,
      tags: [...(this.props.defaultTags || [])],
    };

    if (typeof window !== 'undefined') {
      window.globalTagColors = this.props.defaultTagColors;
      window.globalShowTagColors = !!this.props.defaultShowTagColors;
    }

    this.addTag = this.addTag.bind(this);
    this.setTagColors = this.setTagColors.bind(this);
    this.setShowTagColors = this.setShowTagColors.bind(this);
    this.getTagColorStyle = this.getTagColorStyle.bind(this);
    this.getCardColorClass = getCardColorClass.bind(this);
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

  getTagColorStyle(tags) {
    const tagColor = this.state.tagColors.find(({ tag }) => (tags || []).includes(tag));
    if (tagColor && tagColor.color) {
      const luma = (
        (parseInt(tagColor.color.substring(1, 3), 16) * 299) + 
        (parseInt(tagColor.color.substring(3, 5), 16) * 587) + 
        (parseInt(tagColor.color.substring(5, 7), 16) * 114)
      ) / 1000;
    
      return {color: (luma > 200 ? 'black' : 'white'), backgroundColor: tagColor.color}
    } else {
      return {}
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
      getTagColorStyle: this.getTagColorStyle,
    };
    return <TagContext.Provider value={value}>{this.props.children}</TagContext.Provider>;
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

export default TagContext;
