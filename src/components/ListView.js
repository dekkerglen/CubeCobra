import React, { useCallback, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { Form, Input } from 'reactstrap';

import { cardsAreEquivalent, normalizeName } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import { getLabels, sortDeep } from 'utils/Sort';

import CubeContext from 'contexts/CubeContext';
import GroupModalContext from 'contexts/GroupModalContext';
import PagedTable from 'components/PagedTable';
import SortContext from 'contexts/SortContext';
import TagContext from 'contexts/TagContext';
import TagInput from 'components/TagInput';
import withAutocard from 'components/WithAutocard';
import withLoading from 'components/WithLoading';
import useAlerts, { Alerts } from 'hooks/UseAlerts';

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

const LoadingInput = withLoading(Input, ['onBlur']);
const LoadingInputChange = withLoading(Input, ['onChange']);
const LoadingTagInput = withLoading(TagInput, ['handleInputBlur']);

const defaultVersions = (card) => {
  const fullName = card.details.full_name;
  return [
    {
      ...card.details,
      version: fullName.toUpperCase().substring(fullName.indexOf('[') + 1, fullName.indexOf(']')),
    },
  ];
};

const ListViewRow = ({ card, versions, versionsLoading, checked, onCheck, addAlert }) => {
  // FIXME: This state should just be managed in the card object.
  const [tags, setTags] = useState(card.tags.map((tag) => ({ id: tag, text: tag })));
  const [values, setValues] = useState({
    ...card,
    colors: (card.colors || []).join('') || 'C',
  });

  const { cubeID, updateCubeCard } = useContext(CubeContext);
  const { cardColorClass } = useContext(TagContext);

  const { index } = card;

  const syncCard = useCallback(
    async (updated) => {
      updated = { ...card, ...updated };
      delete updated.details;

      if (cardsAreEquivalent(card, updated)) {
        // no need to sync
        return;
      }

      try {
        const response = await csrfFetch(`/cube/api/updatecard/${cubeID}`, {
          method: 'POST',
          body: JSON.stringify({
            src: card,
            updated,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          addAlert('danger', `Failed to update ${card.details.name} (status ${response.statusCode})`);
          return;
        }

        const json = await response.json();
        if (json.success === 'true') {
          const oldCardID = card.cardID;
          const newCard = { ...card, ...updated };
          updateCubeCard(card.index, newCard);
          if (updated.cardID !== oldCardID) {
            // changed version
            const getResponse = await fetch(`/cube/api/getcardfromid/${updated.cardID}`);
            const getJson = await getResponse.json();
            updateCubeCard(card.index, { ...newCard, details: { ...newCard.details, ...getJson.card } });
          }
        }
      } catch (err) {
        addAlert('danger', 'Failed to send update request.');
        throw err;
      }
    },
    [cubeID, card, updateCubeCard, addAlert],
  );

  const addTag = useCallback(
    async (tag) => {
      const newTags = [...tags, tag];
      setTags(newTags);
      try {
        await syncCard({ tags: newTags.map((newTag) => newTag.text) });
      } catch (err) {
        setTags(tags);
      }
    },
    [syncCard, tags],
  );

  const deleteTag = useCallback(
    async (deleteIndex) => {
      const newTags = tags.filter((tag, tagIndex) => tagIndex !== deleteIndex);
      setTags(newTags);
      try {
        await syncCard({ tags: newTags.map((newTag) => newTag.text) });
      } catch (err) {
        setTags(tags);
      }
    },
    [syncCard, tags],
  );

  const reorderTag = useCallback(
    async (tag, currIndex, newIndex) => {
      const newTags = [...tags];
      newTags.splice(currIndex, 1);
      newTags.splice(newIndex, 0, tag);
      setTags(newTags);
      try {
        await syncCard({ tags: newTags.map((newTag) => newTag.text) });
      } catch (err) {
        setTags(tags);
      }
    },
    [syncCard, tags],
  );

  const tagBlur = useCallback(
    async (tag) => {
      if (tag.trim()) {
        await addTag({
          id: tag.trim(),
          text: tag.trim(),
        });
      }
    },
    [addTag],
  );

  const handleChange = useCallback(
    async (event) => {
      const { target } = event;
      const value = target.type === 'checkbox' ? target.checked : target.value;
      const { name, tagName } = target;

      const updateF = (currentValues) => ({
        ...currentValues,
        [name]: value,
      });

      if (tagName.toLowerCase() === 'select') {
        try {
          const updatedCard = {};
          if (name === 'colors') {
            updatedCard.colors = value === 'C' ? [] : [...value];
          } else {
            updatedCard[name] = value;
          }

          await syncCard(updatedCard);
          setValues(updateF);
        } catch (err) {
          // FIXME: Display in UI.
          console.log(err);
        }
      } else {
        setValues(updateF);
      }
    },
    [syncCard],
  );

  const handleBlur = useCallback(
    async (event) => {
      const { target } = event;
      const { name, value, tagName } = target;

      // <select>s handled in handleChange above.
      if (tagName.toLowerCase() !== 'select') {
        try {
          // Note: We can use this logic on all but the colors field, which is a select anyway so this path is irrelevant.
          await syncCard({
            [name]: value,
          });
        } catch (err) {
          // FIXME: Display in UI.
          console.error(err);
        }
      }
    },
    [syncCard],
  );

  const inputProps = (field) => ({
    bsSize: 'sm',
    spinnerSize: 'sm',
    name: field,
    onChange: handleChange,
    onBlur: handleBlur,
    value: values[field],
    'data-lpignore': true,
  });

  return (
    <tr className={cardColorClass(card)}>
      <td className="align-middle">
        <Input
          type="checkbox"
          bsSize="sm"
          data-index={index}
          checked={checked}
          onChange={onCheck}
          className="d-block mx-auto"
        />
      </td>
      <AutocardTd className="align-middle text-truncate" card={card}>
        {card.details.name}
      </AutocardTd>
      <td>
        <LoadingInputChange
          {...inputProps('cardID')}
          type="select"
          style={{ maxWidth: '6rem' }}
          className="w-100"
          loading={versionsLoading ? true : null}
        >
          {versions.map(({ _id, version }) => (
            <option key={_id} value={_id}>
              {version}
            </option>
          ))}
        </LoadingInputChange>
      </td>
      <td>
        <LoadingInput {...inputProps('type_line')} type="text" />
      </td>
      <td>
        <LoadingInputChange {...inputProps('status')} type="select">
          {getLabels(null, 'Status').map((status) => (
            <option key={status}>{status}</option>
          ))}
        </LoadingInputChange>
      </td>
      <td>
        <LoadingInputChange {...inputProps('finish')} type="select">
          {getLabels(null, 'Finish').map((finish) => (
            <option key={finish}>{finish}</option>
          ))}
        </LoadingInputChange>
      </td>
      <td>
        <LoadingInput {...inputProps('cmc')} type="text" style={{ maxWidth: '3rem' }} />
      </td>
      <td>
        <LoadingInputChange {...inputProps('colors')} type="select">
          {colorCombos.map((combo) => (
            <option key={combo}>{combo}</option>
          ))}
        </LoadingInputChange>
      </td>
      <td style={{ minWidth: '15rem' }}>
        <LoadingTagInput
          tags={tags}
          value={values.tagInput}
          name="tagInput"
          onChange={handleChange}
          handleInputBlur={tagBlur}
          addTag={addTag}
          deleteTag={deleteTag}
          reorderTag={reorderTag}
        />
      </td>
    </tr>
  );
};

ListViewRow.propTypes = {
  card: CardPropType.isRequired,
  versions: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      version: PropTypes.string.isRequired,
    }),
  ).isRequired,
  versionsLoading: PropTypes.bool.isRequired,
  checked: PropTypes.bool.isRequired,
  onCheck: PropTypes.func.isRequired,
  addAlert: PropTypes.func.isRequired,
};

const ListView = ({ cards }) => {
  const [versionDict, setVersionDict] = useState({});
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [checked, setChecked] = useState([]);

  const { cube } = useContext(CubeContext);
  const { setGroupModalCards } = useContext(GroupModalContext);
  const { primary, secondary, tertiary, quaternary, showOther } = useContext(SortContext);

  const { addAlert, alerts } = useAlerts();

  useEffect(() => {
    const wrapper = async () => {
      setVersionsLoading(true);
      const response = await csrfFetch('/cube/api/getversions', {
        method: 'POST',
        body: JSON.stringify(cube.cards.map(({ cardID }) => cardID)),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        console.error(response);
        return;
      }

      const json = await response.json();
      setVersionsLoading(false);
      setVersionDict((current) => ({ ...current, ...json.dict }));
    };
    wrapper();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckAll = useCallback(
    (event) => {
      const value = event.target.checked;

      if (value) {
        setChecked(cards.map(({ index }) => index));
        setGroupModalCards(cards);
      } else {
        setChecked([]);
        setGroupModalCards([]);
      }
    },
    [cards, setGroupModalCards],
  );

  const handleCheck = useCallback(
    (event) => {
      const value = event.target.checked;
      const index = parseInt(event.target.getAttribute('data-index'), 10);
      if (Number.isInteger(index)) {
        let newChecked = checked;
        if (value) {
          if (!newChecked.includes(index)) {
            newChecked = [...checked, index];
          }
        } else {
          newChecked = checked.filter((testIndex) => testIndex !== index);
        }
        setChecked(newChecked);
        setGroupModalCards(
          newChecked.map((cardIndex) => cards.find((card) => card.index === cardIndex)).filter((x) => x),
        );
      }
    },
    [checked, cards, setGroupModalCards],
  );

  const sorted = sortDeep(cards, showOther, quaternary, primary, secondary, tertiary);

  const rows = sorted.map(([, group1]) =>
    group1.map(([, group2]) =>
      group2.map(([, group3]) =>
        group3.map((card) => (
          <ListViewRow
            key={card._id}
            card={card}
            versions={versionDict[normalizeName(card.details.name)] || defaultVersions(card)}
            versionsLoading={versionsLoading}
            checked={checked.includes(card.index)}
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
      <Form inline>
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
      </Form>
    </>
  );
};

ListView.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default ListView;
