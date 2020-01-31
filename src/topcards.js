import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import URLSearchParams from 'core-js-pure/features/url-search-params';

import { encodeName } from 'utils/Card';

import FilterCollapse from 'components/FilterCollapse';
import SortableTable from 'components/SortableTable';
import withAutocard from 'components/WithAutocard';

const AutocardA = withAutocard('a');

class TopCards extends Component {
  constructor(props) {
    super(props);

    const { defaultData, defaultNumResults } = props;

    this.state = {
      filter: [],
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
    const { data, filter, numResults } = this.state;

    const rowF = ([name, img, imgFlip, rating, picks, elo, cubes]) =>
      rating === null ? (
        []
      ) : (
        <tr key={name}>
          <td>
            <AutocardA front={img} back={imgFlip || undefined} href={`/tool/card/${encodeName(name)}`}>
              {name}
            </AutocardA>
          </td>
          <td>{rating === null ? 'None' : ((1 - rating) * 100).toFixed(0)}</td>
          <td>{elo === null ? '' : elo.toFixed(0)}</td>
          <td>{picks === null ? '' : picks}</td>
          <td>{cubes === null ? '' : cubes}</td>
        </tr>
      );

    return (
      <>
        <div className="usercontrols pt-3">
          <h4 className="mx-3 mb-3">Top Cards</h4>
          <FilterCollapse
            isOpen
            filter={filter}
            setFilter={this.setFilter}
            numCards={numResults}
            numShown={data.length}
          />
        </div>
        <SortableTable
          sorts={{
            Rating: (row) => row[3],
            Elo: (row) => -(row[5] || -1),
            'Total Picks': (row) => -row[4],
            Cubes: (row) => -row[6],
          }}
          defaultSort="Rating"
          headers={{
            Name: {},
            Rating: { style: { width: '10rem' }, tooltip: 'Average draft pick position' },
            Elo: { style: { width: '10rem' }, tooltip: 'Elo rating of card' },
            'Total Picks': { style: { width: '10rem' }, tooltip: 'Total picks across all cubes' },
            Cubes: { style: { width: '10rem' }, tooltip: 'Cubes containing this card' },
          }}
          data={data}
          rowF={rowF}
          className="mt-3"
        />
      </>
    );
  }
}

TopCards.propTypes = {
  defaultData: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.any)).isRequired,
  defaultNumResults: PropTypes.number.isRequired,
};

const data = JSON.parse(document.getElementById('topcards').value);
const numResults = parseInt(document.getElementById('topcardsNumResults').value, 10);
const wrapper = document.getElementById('react-root');
const element = <TopCards defaultData={data} defaultNumResults={numResults} />;
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
