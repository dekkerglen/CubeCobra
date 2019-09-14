import React, { Component } from 'react';

import { Col, Input, Pagination, PaginationItem, PaginationLink, Row, Table } from 'reactstrap';

import SortContext from './SortContext';
import TagInput from './TagInput';

const colorCombos = [
  'C', 'W', 'U', 'B', 'R', 'G',
  'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG',
  'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG',
  'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG',
  'WUBRG'
];

class PagedTable extends Component {
  constructor(props) {
    super(props);

    this.state = { page: 0 };

    this.setPage = this.setPage.bind(this);
  }

  setPage(event) {
    event.preventDefault();
    this.setState({
      page: parseInt(event.target.getAttribute('page')),
    });
  }

  componentDidMount() {
    activateTags();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.rows.length !== this.props.rows.length) {
      this.setState({ page: 0 });
    }
  }

  render() {
    const { pageSize, rows, children, ...props } = this.props;
    const { page } = this.state;
    const displayRows = rows.slice(page * pageSize, (page + 1) * pageSize);
    const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];

    return <>
      <Pagination aria-label="Table page" className="mt-3">
        {validPages.map(page =>
          <PaginationItem key={page} active={page === this.state.page}>
            <PaginationLink tag="a" href="#" page={page} onClick={this.setPage}>
              {page + 1}
            </PaginationLink>
          </PaginationItem>
        )}
      </Pagination>
      <Table {...props}>
        {children}
        <tbody>{displayRows}</tbody>
      </Table>
    </>;
  }
}

PagedTable.defaultProps = {
  pageSize: 50,
};

class ListViewRaw extends Component {
  constructor(props) {
    super(props);

    const cardValues = [].concat.apply([], this.props.cards.map(({ index, ...card }) => [
      [`tdcheck${index}`, false],
      [`tdversion${index}`, card.cardID],
      [`tdtype${index}`, card.type_line],
      [`tdstatus${index}`, card.status],
      [`tdcmc${index}`, card.cmc],
      [`tdcolors${index}`, (card.colors || ['C']).join('')],
      [`tags${index}`, (card.tags || []).map(tag => ({ id: tag, text: tag }))],
    ]));

    this.state = {
      ...Object.fromEntries(cardValues),
      versionDict: {},
    };

    this.handleChange = this.handleChange.bind(this);
    this.checkAll = this.checkAll.bind(this);
  }

  updateVersions() {
    const knownIds = new Set(Object.keys(this.state.versionDict));
    const currentIds = this.props.cards.map(card => card.cardID);
    const newIds = currentIds.filter(id => !knownIds.has(id));
    if (newIds.length > 0) {
      fetch('/cube/api/getversions', {
        method: 'POST',
        body: JSON.stringify(newIds),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => response.json()).then(json => {
        this.setState(({ versionDict }) => ({
          versionDict: { ...versionDict, ...json.dict }
        }));
      });
    }
  }

  componentDidMount() {
    this.updateVersions();
  }

  componentDidUpdate() {
    this.updateVersions();
  }

  addTag(cardIndex, tag) {
    const name = `tags${cardIndex}`;
    this.setState(state => ({
      [name]: [...state[name], tag],
    }));
  }

  deleteTag(cardIndex, tagIndex) {
    const name = `tags${cardIndex}`;
    this.setState(state => ({
      [name]: this.state[name].filter((tag, i) => i !== tagIndex),
    }));
  }

  reorderTag(cardIndex, tag, currIndex, newIndex) {
    const name = `tags${cardIndex}`;
    this.setState(state => {
      const tags = [...state[name]];
      tags.splice(currIndex, 1);
      tags.splice(newIndex, 0, tag);
      return {
        [name]: tags,
      };
    });
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value
    });

    // See comment below; this should be restructured.
    if (name.startsWith('tdcheck')) {
      cube[parseInt(target.getAttribute('data-index'))].checked = value;
    }
  }

  checkAll(event) {
    const target = event.target;
    const value = target.checked;

    // This breaks React invariants and we should figure out a different way to pass this data around.
    for (card of this.props.cards) {
      card.checked = value;
    }

    const entries = this.props.cards.map(({ index }) => [`tdcheck${index}`, value]);
    console.log(entries);
    this.setState(Object.fromEntries(entries));
  }

  render() {
    const { cards, primary, secondary, tertiary, ...props } = this.props;
    const groups = {};
    for (const [label1, primaryGroup] of Object.entries(sortIntoGroups(cards, primary))) {
      groups[label1] = {};
      for (const [label2, secondaryGroup] of Object.entries(sortIntoGroups(primaryGroup, secondary))) {
        groups[label1][label2] = sortIntoGroups(secondaryGroup, tertiary);
      }
    }

    const rows =
      [].concat.apply([], getLabels(primary).filter(label1 => groups[label1]).map(label1 =>
        [].concat.apply([], getLabels(secondary).filter(label2 => groups[label1][label2]).map(label2 =>
          [].concat.apply([], getLabels(tertiary).filter(label3 => groups[label1][label2][label3]).map(label3 =>
            groups[label1][label2][label3].map(({ index, details, ...card }) =>
              <tr key={index} className={/* global */ show_tag_colors ? getCardTagColorClass(card) : getCardColorClass(card)}>
                <td className="align-middle">
                  <Input type="checkbox" name={`tdcheck${index}`} data-index={index} checked={this.state[`tdcheck${index}`]} onChange={this.handleChange} />
                </td>
                <td className="align-middle text-truncate">{details.name}</td>
                <td>
                  <Input type="select" bsSize="sm" className="w-100" name={`tdversion${index}`} value={this.state[`tdversion${index}`]} onChange={this.handleChange}>
                    {(this.state.versionDict[card.cardID] || []).map(version =>
                      <option key={version.id} value={version.id}>
                        {version.version}
                      </option>
                    )}
                  </Input>
                </td>
                <td>
                  <Input type="text" bsSize="sm" name={`tdtype${index}`} value={this.state[`tdtype${index}`]} onChange={this.handleChange} />
                </td>
                <td>
                  <Input type="select" bsSize="sm" name={`tdstatus${index}`} value={this.state[`tdstatus${index}`]} onChange={this.handleChange}>
                    {getLabels('Status').map(status =>
                      <option key={status}>{status}</option>
                    )}
                  </Input>
                </td>
                <td>
                  <Input type="text" bsSize="sm" style={{ maxWidth: '3rem' }} name={`tdcmc${index}`} value={this.state[`tdcmc${index}`]} onChange={this.handleChange} />
                </td>
                <td>
                  <Input type="select" bsSize="sm" name={`tdcolors${index}`} value={this.state[`tdcolors${index}`]} onChange={this.handleChange}>
                    {colorCombos.map(combo =>
                      <option key={combo}>{combo}</option>
                    )}
                  </Input>
                </td>
                <td style={{ minWidth: '15rem' }}>
                  <TagInput
                    tags={this.state[`tags${index}`]}
                    addTag={this.addTag.bind(this, index)}
                    deleteTag={this.deleteTag.bind(this, index)}
                    reorderTag={this.reorderTag.bind(this, index)}
                  />
                </td>
              </tr>
            )
          ))
        ))
      ));

    return (
      <form className="form-inline">
        <PagedTable rows={rows} size="sm" {...props}>
          <thead>
            <tr>
              <th className="align-middle">
                <Input type="checkbox" onChange={this.checkAll} />
              </th>
              <th>Name</th>
              <th>Version</th>
              <th>Type</th>
              <th>Status</th>
              <th>CMC</th>
              <th>Color</th>
              <th>Tags</th>
            </tr>
          </thead>
        </PagedTable>
      </form>
    );
  }
}

const ListView = SortContext.Wrapped(ListViewRaw);

export default ListView;
