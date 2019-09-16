import React, { Component } from 'react';

import { Col, Input, Row } from 'reactstrap';

import PagedTable from './PagedTable';
import SortContext from './SortContext';
import TagInput from './TagInput';

const colorCombos = [
  'C', 'W', 'U', 'B', 'R', 'G',
  'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG',
  'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG',
  'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG',
  'WUBRG'
];

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
    this.handleBlur = this.handleBlur.bind(this);
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
    /* global */
    activateTags();

    this.updateVersions();
  }

  componentDidUpdate() {
    this.updateVersions();
  }

  syncCard(index) {
    /* globals */
    const cubeID = document.getElementById('cubeID').value;
    const card = cube[index];
    const updated = { ...card };
    delete updated.details;

    updated.cardID = this.state[`tdversion${index}`];
    updated.type_line = this.state[`tdtype${index}`];
    updated.status = this.state[`tdstatus${index}`];
    updated.cmc = this.state[`tdcmc${index}`];
    updated.tags = this.state[`tags${index}`].map(tagDict => tagDict.text);

    const colorString = this.state[`tdcolors${index}`];
    updated.colors = colorString === 'C' ? [] : [...colorString];

    if (updated.cardID === card.cardID
      && updated.type_line === card.type_line
      && updated.status === card.status
      && updated.cmc === card.cmc
      && updated.colors.join('') === card.colors.join('')
      && updated.tags.join(',') === card.tags.join(',')) {
      // no need to sync
      return;
    }

    fetch(`/cube/api/updatecard/${cubeID}`, {
      method: 'POST',
      body: JSON.stringify({
        src: card,
        updated,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(response => response.json()).catch(err => console.error(err)).then(json => {
      if (json.success === 'true') {
        cube[index] = { ...cube[index], ...updated };
        if (updated.cardID !== card.cardID) {
          // changed version
          fetch(`/cube/api/getcardfromid/${updated.cardID}`).then(
            response => response.json()
          ).then(json => {
            cube[index].details = json.card;
            cube[index].details.display_image = updated.imgUrl || json.card.image_normal;
            cubeDict[cube[index].index] = cube[index];
          });
        }
      }
    });
  }

  addTag(cardIndex, tag) {
    const name = `tags${cardIndex}`;
    this.setState(state => ({
      [name]: [...state[name], tag],
    }));
    this.syncCard(cardIndex);
  }

  deleteTag(cardIndex, tagIndex) {
    const name = `tags${cardIndex}`;
    this.setState(state => ({
      [name]: this.state[name].filter((tag, i) => i !== tagIndex),
    }));
    this.syncCard(cardIndex);
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
    this.syncCard(cardIndex);
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;
    const index = parseInt(target.getAttribute('data-index'));

    this.setState({
      [name]: value
    });

    if (target.getAttribute('type') === 'select') {
      this.syncCard(index);
    }

    // See comment below; this should be restructured.
    if (name.startsWith('tdcheck')) {
      cube[index].checked = value;
    }
  }

  handleBlur(event) {
    const target = event.target;
    const index = parseInt(target.getAttribute('data-index'));
    this.syncCard(index);
  }

  checkAll(event) {
    const target = event.target;
    const value = target.checked;

    // This breaks React invariants and we should figure out a different way to pass this data around.
    // Currently necessary to get the group context modal to work.
    for (const card of this.props.cards) {
      card.checked = value;
    }

    const entries = this.props.cards.map(({ index }) => [`tdcheck${index}`, value]);
    this.setState(Object.fromEntries(entries));
  }

  render() {
    const { cards, primary, secondary, tertiary, changeSort, ...props } = this.props;
    const groups = {};
    for (const [label1, primaryGroup] of Object.entries(sortIntoGroups(cards, primary))) {
      groups[label1] = {};
      for (const [label2, secondaryGroup] of Object.entries(sortIntoGroups(primaryGroup, secondary))) {
        groups[label1][label2] = sortIntoGroups(secondaryGroup, tertiary);
      }
    }

    const inputProps = (index, field) => ({
      bsSize: 'sm',
      name: `td${field}${index}`,
      'data-index': index,
      onChange: this.handleChange,
      onBlur: this.handleBlur,
      [field === 'check' ? 'checked' : 'value']: this.state[`td${field}${index}`],
    });

    const rows =
      [].concat.apply([], getLabels(primary).filter(label1 => groups[label1]).map(label1 =>
        [].concat.apply([], getLabels(secondary).filter(label2 => groups[label1][label2]).map(label2 =>
          [].concat.apply([], getLabels(tertiary).filter(label3 => groups[label1][label2][label3]).map(label3 =>
            groups[label1][label2][label3].map(({ index, details, ...card }) =>
              <tr key={index} className={/* global */ show_tag_colors ? getCardTagColorClass(card) : getCardColorClass(card)}>
                <td className="align-middle">
                  <Input {...inputProps(index, 'check')} type="checkbox" className="d-block mx-auto" />
                </td>
                <td className="align-middle text-truncate autocard" card={details.display_image}>
                  {details.name}
                </td>
                <td>
                  <Input {...inputProps(index, 'version')} type="select" style={{ maxWidth: '6rem' }} className="w-100">
                    {(this.state.versionDict[card.cardID] || []).map(version =>
                      <option key={version.id} value={version.id}>
                        {version.version}
                      </option>
                    )}
                  </Input>
                </td>
                <td>
                  <Input {...inputProps(index, 'type')} type="text" />
                </td>
                <td>
                  <Input {...inputProps(index, 'status')} type="select">
                    {getLabels('Status').map(status =>
                      <option key={status}>{status}</option>
                    )}
                  </Input>
                </td>
                <td>
                  <Input {...inputProps(index, 'cmc')} type="text" style={{ maxWidth: '3rem' }} />
                </td>
                <td>
                  <Input {...inputProps(index, 'colors')} type="select">
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
                <Input type="checkbox" className="d-block mx-auto" onChange={this.checkAll} />
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
