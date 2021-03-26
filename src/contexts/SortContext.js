import React from 'react';
import PropTypes from 'prop-types';

const SortContext = React.createContext({
  primary: 'Color Category',
  secondary: 'Types-Multicolor',
  tertiary: 'CMC',
  quaternary: 'Alphabetical',
});

export class SortContextProvider extends React.Component {
  constructor(props) {
    super(props);
    const {
      defaultSorts: [
        primary = 'Color Category',
        secondary = 'Types-Multicolor',
        tertiary = 'CMC',
        quaternary = 'Alphabetical',
      ],
    } = this.props;

    this.state = {
      primary,
      secondary,
      tertiary,
      quaternary,
    };

    this.changeSort = this.changeSort.bind(this);
  }

  componentDidMount() {
    for (const stage of ['primary', 'secondary', 'tertiary', 'quaternary']) {
      const select = document.getElementById(`${stage}SortSelect`);
      if (select) {
        select.addEventListener('change', (event) => {
          this.setState({
            [stage]: event.target.value,
          });
        });
      }
    }
  }

  changeSort(change) {
    this.setState(change);
  }

  render() {
    const value = {
      ...this.state,
      changeSort: this.changeSort,
    };
    return <SortContext.Provider value={value} {...this.props} />;
  }
}

SortContextProvider.propTypes = {
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
};

SortContext.Wrapped = (Tag) => (props) => (
  <SortContext.Consumer>{(value) => <Tag {...props} {...value} />}</SortContext.Consumer>
);

export default SortContext;
