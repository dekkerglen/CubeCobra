import { createContext, Component } from 'react';
import PropTypes from 'prop-types';

import { csrfFetch } from 'utils/CSRF';

export const getCardColorClass = (card) => {
  const type = card.type_line || card.details.type;
  const colors = card.colors || card.details.color_identity;
  if (type.toLowerCase().includes('land')) {
    return 'lands';
  }
  if (colors.length === 0) {
    return 'colorless';
  }
  if (colors.length > 1) {
    return 'multi';
  }
  if (colors.length === 1 && [...'WUBRGC'].includes(colors[0])) {
    return {
      W: 'white',
      U: 'blue',
      B: 'black',
      R: 'red',
      G: 'green',
      C: 'colorless',
    }[colors[0]];
  }
  return 'colorless';
};

export const getCardTagColorClass = (tagColors, card) => {
  const tagColor = tagColors.find(({ tag }) => (card.tags || []).includes(tag));
  if (tagColor && tagColor.color) {
    return `tag-color tag-${tagColor.color}`;
  }
  return getCardColorClass(card);
};

export const getTagColorClass = (tagColors, tag) => {
  const tagColor = tagColors.find((tagColorB) => tag === tagColorB.tag);
  if (tagColor && tagColor.color) {
    return `tag-color tag-${tagColor.color}`;
  }
  return 'tag-no-color';
};

export const TAG_COLORS = [
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
];

const TagContext = createContext({
  addSuggestion: () => {
    console.error('Error: No TagContext!');
  },
  allSuggestions: [],
});

export class TagContextProvider extends Component {
  constructor(props) {
    super(props);
    const { defaultTagColors, defaultShowTagColors, defaultTags } = this.props;

    this.state = {
      tagColors: [...(defaultTagColors || [])],
      showTagColors: !!defaultShowTagColors,
      tags: [...(defaultTags || [])],
    };

    if (typeof window !== 'undefined') {
      window.globalTagColors = defaultTagColors;
      window.globalShowTagColors = !!defaultShowTagColors;
    }

    this.addTag = this.addTag.bind(this);
    this.setTagColors = this.setTagColors.bind(this);
    this.setShowTagColors = this.setShowTagColors.bind(this);
    this.cardColorClass = this.cardColorClass.bind(this);
    this.tagColorClass = this.tagColorClass.bind(this);
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

  addTag(tag) {
    this.setState(({ tags }) => (tags.some((t) => t.id === tag.id) ? {} : { tags: [...tags, tag] }));
  }

  cardColorClass(card) {
    const { showTagColors, tagColors } = this.state;
    if (showTagColors) {
      return getCardTagColorClass(tagColors, card);
    }
    return getCardColorClass(card);
  }

  tagColorClass(tag) {
    const { showTagColors, tagColors } = this.state;
    if (showTagColors) {
      return getTagColorClass(tagColors, tag);
    }
    return 'tag-no-color';
  }

  render() {
    const { children } = this.props;
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
    return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
  }
}

TagContextProvider.propTypes = {
  cubeID: PropTypes.string.isRequired,
  defaultTagColors: PropTypes.arrayOf(PropTypes.string),
  defaultShowTagColors: PropTypes.bool,
  defaultTags: PropTypes.arrayOf(PropTypes.string),
  children: PropTypes.node.isRequired,
};
TagContextProvider.defaultProps = {
  defaultTagColors: [],
  defaultShowTagColors: false,
  defaultTags: [],
};

export default TagContext;
