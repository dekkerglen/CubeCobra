import React, { Component } from 'react';

import { Input } from 'reactstrap';

import { csrfFetch } from '../util/CSRF';
import { arraysEqual, fromEntries } from '../util/Util';

import GroupModalContext from './GroupModalContext';
import PagedTable from './PagedTable';
import SortContext from './SortContext';
import TagContext from './TagContext';
import TagInput from './TagInput';
import withAutocard from './WithAutocard';

const colorCombos = [
  'C',
  'W',
  'U',
  'B',
  'R',
  'G',
  'WU',
  'WB',
  'WR',
  'WG',
  'UB',
  'UR',
  'UG',
  'BR',
  'BG',
  'RG',
  'WUB',
  'WUR',
  'WUG',
  'WBR',
  'WBG',
  'WRG',
  'UBR',
  'UBG',
  'URG',
  'BRG',
  'WUBR',
  'WUBG',
  'WURG',
  'WBRG',
  'UBRG',
  'WUBRG',
];

const AutocardTd = withAutocard('td');

class ListViewRaw extends Component {
  constructor(props) {
    super(props);

    const cardValues = [].concat.apply(
      [],
      this.props.cards.map(({ index, ...card }) => [
        [`tdcheck${index}`, false],
        [`tdversion${index}`, card.cardID],
        [`tdtype${index}`, card.type_line],
        [`tdstatus${index}`, card.status],
        [`tdfinish${index}`, card.finish],
        [`tdcmc${index}`, card.cmc],
        [`tdcolors${index}`, (card.colors || ['C']).join('')],
        [`tags${index}`, (card.tags || []).map((tag) => ({ id: tag, text: tag }))],
      ]),
    );

    this.state = {
      ...fromEntries(cardValues),
      versionDict: {},
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.checkAll = this.checkAll.bind(this);
  }

  updateVersions() {
    const knownIds = new Set(Object.keys(this.state.versionDict));
    const currentIds = this.props.cards.map((card) => card.cardID);
    const newIds = currentIds.filter((id) => !knownIds.has(id));
    if (newIds.length > 0) {
      csrfFetch('/cube/api/getversions', {
        method: 'POST',
        body: JSON.stringify(newIds),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((json) => {
          this.setState(({ versionDict }) => ({
            versionDict: { ...versionDict, ...json.dict },
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

  syncCard(index, updated, setStateCallback) {
    /* globals */
    const cubeID = document.getElementById('cubeID').value;
    const card = cube[index];

    updated = { ...card, ...updated };
    delete updated.details;

    if (
      updated.cardID === card.cardID &&
      updated.type_line === card.type_line &&
      updated.status === card.status &&
      updated.cmc === card.cmc &&
      arraysEqual(updated.colors, card.colors) &&
      arraysEqual(updated.tags, card.tags) &&
      updated.finish === card.finish
    ) {
      // no need to sync
      return;
    }

    csrfFetch(`/cube/api/updatecard/${cubeID}`, {
      method: 'POST',
      body: JSON.stringify({
        src: card,
        updated,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .catch((err) => console.error(err))
      .then((json) => {
        if (json.success === 'true') {
          cube[index] = { ...cube[index], ...updated };
          if (updated.cardID !== card.cardID) {
            // changed version
            fetch(`/cube/api/getcardfromid/${updated.cardID}`)
              .then((response) => response.json())
              .then((json) => {
                cube[index].details = json.card;
                cube[index].details.display_image = updated.imgUrl || json.card.image_normal;
                cubeDict[cube[index].index] = cube[index];
              })
              .catch((err) => console.error(err));
          }
          setStateCallback();
        }
      })
      .catch((err) => console.error(err));
  }

  addTag(cardIndex, tag) {
    const name = `tags${cardIndex}`;
    const newTags = [...this.state[name], tag];
    this.syncCard(cardIndex, { tags: newTags.map((tag) => tag.text) }, () => {
      this.setState({
        [name]: newTags,
      });
    });
  }

  deleteTag(cardIndex, tagIndex) {
    const name = `tags${cardIndex}`;
    const newTags = this.state[name].filter((tag, i) => i !== tagIndex);
    this.syncCard(cardIndex, { tags: newTags.map((tag) => tag.text) }, () => {
      this.setState({
        [name]: newTags,
      });
    });
  }

  reorderTag(cardIndex, tag, currIndex, newIndex) {
    const name = `tags${cardIndex}`;
    const newTags = [...this.state[name]];
    newTags.splice(currIndex, 1);
    newTags.splice(newIndex, 0, tag);
    this.syncCard(cardIndex, { tags: newTags.map((tag) => tag.text) }, () => {
      this.setState({
        [name]: newTags,
      });
    });
  }

  getChecked() {
    return this.props.cards.filter(({ index }) => this.state[`tdcheck${index}`]);
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;
    const index = parseInt(target.getAttribute('data-index'));

    if (target.tagName.toLowerCase() === 'select') {
      const updated = {};
      if (name.startsWith('tdversion')) {
        updated.cardID = value;
      } else if (name.startsWith('tdstatus')) {
        updated.status = value;
      } else if (name.startsWith('tdfinish')) {
        updated.finish = value;
      } else if (name.startsWith('tdcolor')) {
        updated.colors = value === 'C' ? [] : [...value];
      }
      this.syncCard(index, updated, () => {
        this.setState({
          [name]: value,
        });
      });
    } else if (name.startsWith('tdcheck')) {
      this.setState({
        [name]: value,
      });
      let checked = this.getChecked();
      if (value && !checked.some((card) => card.index === index)) {
        checked.push(this.props.cards.find((card) => card.index === index));
      } else if (!value) {
        checked = checked.filter((card) => card.index !== index);
      }
      this.props.setGroupModalCards(checked);
    }
  }

  handleBlur(event) {
    const target = event.target;
    const index = parseInt(target.getAttribute('data-index'));

    const colorString = this.state[`tdcolors${index}`];
    const updated = {
      cardID: this.state[`tdversion${index}`],
      type_line: this.state[`tdtype${index}`],
      status: this.state[`tdstatus${index}`],
      cmc: this.state[`tdcmc${index}`],
      tags: this.state[`tags${index}`].map((tagDict) => tagDict.text),
      colors: colorString === 'C' ? [] : [...colorString],
    };

    // <select>s handled in handleChange above.
    if (target.tagName.toLowerCase() !== 'select') {
      this.syncCard(index, updated);
    }
  }

  checkAll(event) {
    const target = event.target;
    const value = target.checked;

    const entries = this.props.cards.map(({ index }) => [`tdcheck${index}`, value]);
    this.setState(fromEntries(entries));

    this.props.setGroupModalCards(this.props.cards);
  }

  render() {
    const { cards, primary, secondary, tertiary, changeSort, cardColorClass } = this.props;
    const groups = {};
    for (const [label1, primaryGroup] of Object.entries(sortIntoGroups(cards, primary))) {
      groups[label1] = sortIntoGroups(primaryGroup, secondary);
    }

    const inputProps = (index, field) => ({
      bsSize: 'sm',
      name: `td${field}${index}`,
      'data-index': index,
      onChange: this.handleChange,
      onBlur: this.handleBlur,
      [field === 'check' ? 'checked' : 'value']: this.state[`td${field}${index}`],
    });

    const rows = [].concat.apply(
      [],
      getLabels(primary)
        .filter((label1) => groups[label1])
        .map((label1) =>
          [].concat.apply(
            [],
            getLabels(secondary)
              .filter((label2) => groups[label1][label2])
              .map((label2) =>
                groups[label1][label2]
                  .sort(function(a, b) {
                    const textA = a.details.name.toUpperCase();
                    const textB = b.details.name.toUpperCase();
                    return textA < textB ? -1 : textA > textB ? 1 : 0;
                  })
                  .map(({ index, details, ...card }) => (
                    <tr key={index} className={cardColorClass(card)}>
                      <td className="align-middle">
                        <Input {...inputProps(index, 'check')} type="checkbox" className="d-block mx-auto" />
                      </td>
                      <AutocardTd className="align-middle text-truncate" card={{ details, ...card }}>
                        {details.name}
                      </AutocardTd>
                      <td>
                        <Input
                          {...inputProps(index, 'version')}
                          type="select"
                          style={{ maxWidth: '6rem' }}
                          className="w-100"
                        >
                          {(this.state.versionDict[card.cardID] || []).map((version) => (
                            <option key={version.id} value={version.id}>
                              {version.version}
                            </option>
                          ))}
                        </Input>
                      </td>
                      <td>
                        <Input {...inputProps(index, 'type')} type="text" />
                      </td>
                      <td>
                        <Input {...inputProps(index, 'status')} type="select">
                          {getLabels('Status').map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </Input>
                      </td>
                      <td>
                        <Input {...inputProps(index, 'finish')} type="select">
                          {getLabels('Finish').map((finish) => (
                            <option key={finish}>{finish}</option>
                          ))}
                        </Input>
                      </td>
                      <td>
                        <Input {...inputProps(index, 'cmc')} type="text" style={{ maxWidth: '3rem' }} />
                      </td>
                      <td>
                        <Input {...inputProps(index, 'colors')} type="select">
                          {colorCombos.map((combo) => (
                            <option key={combo}>{combo}</option>
                          ))}
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
                  )),
              ),
          ),
        ),
    );

    return (
      <form className="form-inline">
        <PagedTable rows={rows} size="sm">
          <thead>
            <tr>
              <th className="align-middle">
                <Input type="checkbox" className="d-block mx-auto" onChange={this.checkAll} />
              </th>
              <th>Name</th>
              <th>Version</th>
              <th>Type</th>
              <th>Status</th>
              <th>Finish</th>
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

const ListView = (props) => (
  <SortContext.Consumer>
    {(sortValue) => (
      <TagContext.Consumer>
        {({ cardColorClass }) => (
          <GroupModalContext.Consumer>
            {({ setGroupModalCards, openGroupModal }) => (
              <ListViewRaw {...sortValue} {...{ cardColorClass, setGroupModalCards, openGroupModal }} {...props} />
            )}
          </GroupModalContext.Consumer>
        )}
      </TagContext.Consumer>
    )}
  </SortContext.Consumer>
);

export default ListView;
