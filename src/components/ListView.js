import React, { useCallback, useContext, useState } from 'react';
import { Button, Input } from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import PagedTable from 'components/PagedTable';
import TagInput from 'components/TagInput';
import withAutocard from 'components/WithAutocard';
import CubeContext from 'contexts/CubeContext';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import { cardCmc, cardColorIdentity, cardFinish, cardStatus, cardTags, cardType, normalizeName } from 'utils/Card';
import { getLabels, sortDeep } from 'utils/Sort';
import { getCardColorClass } from 'utils/Util';

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

const defaultVersions = (card) => {
  const fullName = card.details.full_name;
  return [
    {
      ...card.details,
      version: fullName.toUpperCase().substring(fullName.indexOf('[') + 1, fullName.indexOf(']')),
    },
  ];
};

const ListViewRow = ({ card, versions, checked, onCheck }) => {
  const [tagInput, setTagInput] = useState('');
  const { editCard, tagColors } = useContext(CubeContext);

  const updateField = useCallback(
    (field, value) => {
      editCard(card.index, { ...card, [field]: value }, card.board);
    },
    [card, editCard],
  );

  return (
    <tr className={getCardColorClass(card)}>
      <td>
        <Input type="checkbox" checked={checked} onChange={() => onCheck(card)} className="mx-auto" />
      </td>
      <AutocardTd className="align-middle text-truncate" card={card}>
        {card.details.name}
      </AutocardTd>
      <td>
        <Input
          type="select"
          name="version"
          value={card.cardID}
          onChange={(e) => updateField('cardID', e.target.value)}
          style={{ maxWidth: '6rem' }}
          className="w-100"
        >
          {Object.entries(versions).map(([key, value]) => {
            return (
              <option key={key} value={key}>
                {value.version}
              </option>
            );
          })}
        </Input>
      </td>
      <td>
        <Input
          type="text"
          name="type_line"
          value={cardType(card)}
          onChange={(event) => updateField('type_line', event.target.value)}
        />
      </td>
      <td>
        <Input
          type="select"
          name="status"
          id="cardModalStatus"
          value={cardStatus(card)}
          onChange={(event) => updateField('status', event.target.value)}
        >
          {getLabels(null, 'Status').map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Input>
      </td>
      <td>
        <Input
          type="select"
          name="finish"
          id="cardModalFinish"
          value={cardFinish(card)}
          onChange={(event) => updateField('finish', event.target.value)}
        >
          {getLabels(null, 'Finish').map((finish) => (
            <option key={finish}>{finish}</option>
          ))}
        </Input>
      </td>
      <td>
        <Input
          type="text"
          name="cmc"
          value={cardCmc(card)}
          onChange={(event) => updateField('cmc', event.target.value)}
          style={{ maxWidth: '3rem' }}
        />
      </td>
      <td>
        <Input
          type="select"
          value={cardColorIdentity(card)}
          onChange={(event) => updateField('colors', event.target.value)}
        >
          {colorCombos.map((combo) => (
            <option key={combo}>{combo}</option>
          ))}
        </Input>
      </td>
      <td style={{ minWidth: '15rem' }}>
        <TagInput
          tags={cardTags(card).map((tag) => ({ text: tag, id: tag }))}
          inputValue={tagInput}
          handleInputChange={setTagInput}
          handleInputBlur={(tag) => {
            updateField('tags', [...cardTags(card), tag.text]);
            setTagInput('');
          }}
          addTag={(tag) => {
            updateField('tags', [...cardTags(card), tag.text]);
            setTagInput('');
          }}
          deleteTag={(index) => {
            const newTags = [...cardTags(card)];
            newTags.splice(index, 1);
            updateField('tags', newTags);
          }}
          reorderTag={(oldIndex, newIndex) => {
            const newTags = [...cardTags(card)];
            const tag = newTags.splice(oldIndex, 1)[0];
            newTags.splice(newIndex, 0, tag);
            updateField('tags', newTags);
          }}
          tagColors={tagColors}
        />
      </td>
    </tr>
  );
};

ListViewRow.propTypes = {
  card: CardPropType.isRequired,
  versions: PropTypes.shape({}).isRequired,
  checked: PropTypes.bool.isRequired,
  onCheck: PropTypes.func.isRequired,
};

const ListView = ({ cards }) => {
  const [checked, setChecked] = useState([]);

  const {
    cube,
    setModalSelection,
    sortPrimary,
    sortSecondary,
    sortTertiary,
    sortQuaternary,
    versionDict,
    setModalOpen,
  } = useContext(CubeContext);

  const { addAlert, alerts } = useAlerts();

  const handleCheckAll = useCallback(
    (event) => {
      const value = event.target.checked;

      if (value) {
        setChecked(cards.map(({ board, index }) => `${board}:${index}`));
      } else {
        setChecked([]);
      }
    },
    [cards],
  );

  const handleCheck = useCallback(
    (card) => {
      const { index, board } = card;
      const value = !checked.includes(`${board}:${index}`);
      let newChecked = [...checked];
      if (value) {
        if (!newChecked.includes(index)) {
          newChecked = [...checked, `${board}:${index}`];
        }
      } else {
        newChecked = checked.filter((item) => item !== `${board}:${index}`);
      }
      setChecked(newChecked);
    },
    [checked],
  );

  const sorted = sortDeep(cards, cube.showUnsorted, sortQuaternary, sortPrimary, sortSecondary, sortTertiary);

  const rows = sorted.map(([, group1]) =>
    group1.map(([, group2]) =>
      group2.map(([, group3]) =>
        group3.map((card) => (
          <ListViewRow
            key={card.index}
            card={card}
            versions={
              versionDict[normalizeName(card.details.name)]
                ? Object.fromEntries(versionDict[normalizeName(card.details.name)].map((v) => [v.scryfall_id, v]))
                : defaultVersions(card)
            }
            checked={checked.includes(`${card.board}:${card.index}`)}
            onCheck={handleCheck}
            addAlert={addAlert}
          />
        )),
      ),
    ),
  );

  const rowsFlat = [].concat(...[].concat(...[].concat(...rows)));

  return (
    <>
      <Alerts alerts={alerts} />
      {checked.length > 0 && (
        <Button
          block
          outline
          color="success"
          onClick={() => {
            setModalSelection(cards.filter((c) => checked.includes(`${c.board}:${c.index}`)));
            setModalOpen(true);
          }}
        >
          {`Edit ${checked.length} card${checked.length > 1 ? 's' : ''}`}
        </Button>
      )}
      <PagedTable rows={rowsFlat} size="sm" className="list-view-table">
        <thead>
          <tr>
            <th className="align-middle">
              <Input type="checkbox" className="d-block mx-auto" onChange={handleCheckAll} />
            </th>
            <th>Name</th>
            <th>Version</th>
            <th>Type</th>
            <th>Status</th>
            <th>Finish</th>
            <th>MV</th>
            <th>Color</th>
            <th>Tags</th>
          </tr>
        </thead>
      </PagedTable>
    </>
  );
};

ListView.propTypes = {
  cards: PropTypes.arrayOf(CardPropType.isRequired).isRequired,
};

export default ListView;
