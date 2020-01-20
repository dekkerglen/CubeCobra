import React, { useCallback, useContext, useState, useEffect } from 'react';

import { Form, Input } from 'reactstrap';

import { cardsAreEquivalent } from '../util/Card';
import { csrfFetch } from '../util/CSRF';
import { getLabels, sortDeep } from '../util/Sort';

import CubeContext from './CubeContext';
import GroupModalContext from './GroupModalContext';
import PagedTable from './PagedTable';
import SortContext from './SortContext';
import TagContext from './TagContext';
import TagInput from './TagInput';
import withAutocard from './WithAutocard';
import withLoading from './WithLoading';

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

const ListViewRow = ({ card, versions, checked, onCheck }) => {
  const [tags, setTags] = useState(card.tags.map((tag) => ({ id: tag, text: tag })));
  const [values, setValues] = useState({
    ...card,
    colors: card.colors.join('') || 'C',
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
      const json = await response.json();

      if (json.success === 'true') {
        const oldCardID = card.cardID;
        card = { ...card, ...updated };
        updateCubeCard(card.index, card);
        if (updated.cardID !== oldCardID) {
          // changed version
          const getResponse = await fetch(`/cube/api/getcardfromid/${updated.cardID}`);
          const getJson = await getResponse.json();
          updateCubeCard(card.index, { ...card, details: getJson.card });
        }
      }
    },
    [cubeID, card],
  );

  const addTag = useCallback(
    async (tag) => {
      const newTags = [...tags, tag];
      setTags(newTags);
      await syncCard({ tags: newTags.map((tag) => tag.text) });
    },
    [syncCard, tags],
  );

  const deleteTag = useCallback(
    async (tagIndex) => {
      const newTags = tags.filter((tag, index) => index !== tagIndex);
      setTags(newTags);
      await syncCard({ tags: newTags.map((tag) => tag.text) });
    },
    [syncCard, tags],
  );

  const reorderTag = useCallback(
    async (tag, currIndex, newIndex) => {
      const newTags = [...tags];
      newTags.splice(currIndex, 1);
      newTags.splice(newIndex, 0, tag);
      setTags(newTags);
      await syncCard({ tags: newTags.map((tag) => tag.text) });
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
      const target = event.target;
      const value = target.type === 'checkbox' ? target.checked : target.value;
      const name = target.name;

      const updateF = (values) => ({
        ...values,
        [name]: value,
      });

      if (target.tagName.toLowerCase() === 'select') {
        try {
          const updatedCard = {};
          if (name === 'colors') {
            updatedCard.colors = value === 'C' ? [] : [...value];
          } else {
            updatedCard[name] = value;
          }

          // TODO: Apply some kind of loading indicator to the element.
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
      const target = event.target;
      const name = target.name;
      const value = target.value;

      // <select>s handled in handleChange above.
      if (target.tagName.toLowerCase() !== 'select') {
        try {
          // TODO: Apply some kind of loading indicator to the element.
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
          value={checked}
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
          disabled={versions.length === 0}
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.version}
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

const ListView = ({ cards }) => {
  const [versionDict, setVersionDict] = useState({});
  const [checked, setChecked] = useState([]);

  const { setGroupModalCards } = useContext(GroupModalContext);
  const { primary, secondary } = useContext(SortContext);

  useEffect(() => {
    const wrapper = async () => {
      const knownIds = new Set(Object.keys(versionDict));
      const currentIds = cards.map((card) => card.cardID);
      const newIds = currentIds.filter((id) => !knownIds.has(id));
      if (newIds.length > 0) {
        const response = await csrfFetch('/cube/api/getversions', {
          method: 'POST',
          body: JSON.stringify(newIds),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          return console.error(response);
        }

        const json = await response.json();
        setVersionDict((versionDict) => ({ ...versionDict, ...json.dict }));
      }
    };
    wrapper();
  }, [cards, versionDict]);

  const handleCheckAll = useCallback((event) => {
    const target = event.target;
    const value = target.checked;

    if (value) {
      setChecked(cards.map(({ index }) => index));
      setGroupModalCards(cards);
    } else {
      setChecked([]);
      setGroupModalCards([]);
    }
  }, []);

  const handleCheck = useCallback(
    (event) => {
      const value = event.target.checked;
      const index = parseInt(event.target.getAttribute('data-index'));
      if (!isNaN(value)) {
        let newChecked = checked;
        if (value) {
          if (!newChecked.includes(index)) {
            newChecked = [...checked, index];
          }
        } else {
          newChecked = checked.filter((testIndex) => testIndex !== index);
        }
        setChecked(newChecked);
        setGroupModalCards(newChecked.map((index) => cards.find((card) => card.index === index)).filter((x) => x));
      }
    },
    [checked],
  );

  const sorted = sortDeep(cards, primary, secondary);

  const rows = sorted.map(([label1, group1]) =>
    group1.map(([label2, group2]) =>
      group2.map((card) => (
        <ListViewRow
          key={card._id}
          card={card}
          versions={versionDict[card.cardID] || []}
          checked={checked.includes(card.index)}
          onCheck={handleCheck}
        />
      )),
    ),
  );

  const rowsFlat = [].concat.apply([], [].concat.apply([], rows));

  return (
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
            <th>CMC</th>
            <th>Color</th>
            <th>Tags</th>
          </tr>
        </thead>
      </PagedTable>
    </Form>
  );
};

export default ListView;
