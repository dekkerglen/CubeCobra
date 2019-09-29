import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import FilterCollapse from './components/FilterCollapse';
import PagedTable from './components/PagedTable';

const compare = ([_a, _b, x], [_c, _d, y]) => {
  return (y || 0) - (x || 0);
}

class TopCards extends Component {
  constructor(props) {
    super(props);

    this.state = {
      filter: [],
      data: this.props.defaultData.sort(compare) || [],
    };

    this.setFilter = this.setFilter.bind(this);
  }

  componentDidMount() {
    /* global */ autocard_init('autocard');
  }

  componentDidUpdate() {
    /* global */ autocard_init('autocard');
  }

  setFilter(filter, filterInput) {
    const params = new URLSearchParams([['f', filterInput]]);
    this.setState({ filter });
    fetch('/tool/api/topcards?' + params.toString()).then(response => response.json()).then(json => {
      this.setState({ data: json.data.sort(compare) });
    }).catch(err => console.error(err));
  }

  render() {
    const rows = this.state.data.map(([name, img, img_flip, rating]) => rating === null ? [] :
      <tr key={name}>
        <td className="autocard" card={img} card_flip={img_flip || undefined}>{name}</td>
        <td>{rating === null ? 'None' : (rating * 100).toFixed(0)}</td>
      </tr>
    ).flat();
    return <>
      <div className="usercontrols pt-3">
        <h4 className="mx-3 mb-3">Top Cards</h4>
        <FilterCollapse
          isOpen={true}
          filter={this.state.filter}
          setFilter={this.setFilter}
          numCards={rows.length}
          useQuery
        />
      </div>
      <PagedTable rows={rows}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Rating</th>
          </tr>
        </thead>
      </PagedTable>
    </>;
  }
}

const data = JSON.parse(document.getElementById('topcards').value);
const wrapper = document.getElementById('react-root');
const element = <TopCards defaultData={data} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
