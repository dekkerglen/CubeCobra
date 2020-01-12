import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import FilterCollapse from './components/FilterCollapse';
import SortableTable from './components/SortableTable';
import withAutocard from './components/WithAutocard';
import { encodeName } from './util/Card';

const AutocardTd = withAutocard('td');

class TopCards extends Component {
  constructor(props) {
    super(props);

    this.state = {
      filter: [],
      data: this.props.defaultData || [],
      numResults: this.props.defaultNumResults || 0,
    };

    this.setFilter = this.setFilter.bind(this);
  }

  setFilter(filter, filterInput) {
    const params = new URLSearchParams([['f', filterInput]]);
    this.setState({ filter });
    fetch('/tool/api/topcards?' + params.toString())
      .then((response) => response.json())
      .then((json) => {
        this.setState({
          data: json.data,
          numResults: json.numResults,
        });
      })
      .catch((err) => console.error(err));
  }

  render() {
    const rowF = ([name, img, img_flip, rating, picks, elo, cubes]) =>
      rating === null ? (
        []
      ) : (
        <tr key={name}>
          <AutocardTd front={img} back={img_flip || undefined}>
            <a href={'/tool/card/' + encodeName(name)}>{name}</a>
          </AutocardTd>
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
            isOpen={true}
            filter={this.state.filter}
            setFilter={this.setFilter}
            numCards={this.state.numResults}
            numShown={this.state.data.length}
            useQuery
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
          data={this.state.data}
          rowF={rowF}
          className="mt-3"
        />
      </>
    );
  }
}

const data = JSON.parse(document.getElementById('topcards').value);
const numResults = parseInt(document.getElementById('topcardsNumResults').value);
const wrapper = document.getElementById('react-root');
const element = <TopCards defaultData={data} defaultNumResults={numResults} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
