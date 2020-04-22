import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import URLSearchParams from 'core-js-pure/features/url-search-params';

import { encodeName } from 'utils/Card';
import { makeFilter } from 'filtering/FilterCards';

import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import FilterCollapse from 'components/FilterCollapse';
import SortableTable from 'components/SortableTable';
import withAutocard from 'components/WithAutocard';

const AutocardA = withAutocard('a');

class TopCards extends Component {
  constructor(props) {
    super(props);

    const { defaultData, defaultNumResults, defaultFilterText } = props;

    this.state = {
      filter: (defaultFilterText && makeFilter(defaultFilterText).filter) || null,
      data: defaultData || [],
      numResults: defaultNumResults || 0,
    };

    this.setFilter = this.setFilter.bind(this);
  }

  async setFilter(filter, filterInput) {
    const params = new URLSearchParams([['f', filterInput]]);
    this.setState({ filter });
    const response = await fetch(`/tool/api/topcards?${params.toString()}`);
    if (!response.ok) {
      return;
    }

    const json = await response.json();
    this.setState({
      data: json.data,
      numResults: json.numResults,
    });
  }

  render() {
    const { defaultFilterText } = this.props;
    const { data, filter, numResults } = this.state;

    const rowF = ([name, img, imgFlip, rating, picks, elo, cubes]) => (
      <tr key={name}>
        <td>
          <AutocardA front={img} back={imgFlip || undefined} href={`/tool/card/${encodeName(name)}`}>
            {name}
          </AutocardA>
        </td>
        <td>{rating === null ? '' : ((1 - rating) * 100).toFixed(0)}</td>
        <td>{elo === null ? '' : elo.toFixed(0)}</td>
        <td>{picks === null ? '' : picks}</td>
        <td>{cubes === null ? '' : cubes}</td>
      </tr>
    );

    return (
      <>
        <div className="usercontrols pt-3 mb-3">
          <h4 className="mx-3 mb-3">Top Cards</h4>
          <FilterCollapse
            isOpen
            defaultFilterText={defaultFilterText}
            filter={filter}
            setFilter={this.setFilter}
            numCards={numResults}
            numShown={data.length}
          />
        </div>
        <DynamicFlash />
        <SortableTable
          sorts={{
            Rating: (row) => row[3],
            Elo: (row) => -(row[5] || -1),
            'Total Picks': (row) => -row[4],
            Cubes: (row) => -row[6],
          }}
          defaultSort="Elo"
          headers={{
            Name: {},
            Rating: { style: { width: '8rem' }, tooltip: 'Average draft pick position' },
            Elo: { style: { width: '8rem' }, tooltip: 'Elo rating of card' },
            'Total Picks': { style: { width: '8rem' }, tooltip: 'Total picks across all cubes' },
            Cubes: { style: { width: '8rem' }, tooltip: 'Cubes containing this card' },
          }}
          data={data}
          rowF={rowF}
        />
      </>
    );
  }
}

TopCards.propTypes = {
  defaultData: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.any)).isRequired,
  defaultNumResults: PropTypes.number.isRequired,
  defaultFilterText: PropTypes.string.isRequired,
};

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary className="mt-3">
    <TopCards {...window.reactProps} />
  </ErrorBoundary>
);
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
