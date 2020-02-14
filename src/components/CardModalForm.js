import React, { useCallback, useContext, useState } from 'react';

import { cardsAreEquivalent } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import { arrayMove } from 'utils/Util';

import CardModal from 'components/CardModal';
import CardModalContext from 'components/CardModalContext';
import ChangelistContext from 'components/ChangelistContext';
import CubeContext from 'components/CubeContext';
import MaybeboardContext from 'components/MaybeboardContext';

const CardModalForm = ({ children, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cardIndex, setCardIndex] = useState(null);
  const [maybe, setMaybe] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [formValues, setFormValues] = useState({ tags: [] });

  const { addChange } = useContext(ChangelistContext);
  const { maybeboard, updateMaybeboardCard } = useContext(MaybeboardContext);
  const { cube, canEdit, cubeID, updateCubeCard } = useContext(CubeContext);

  const card = (maybe ? maybeboard[cardIndex] : cube.cards[cardIndex]) || { colors: [], details: {}, tags: [] };

  const setTagInput = useCallback(
    (value) =>
      setFormValues((formValues) => ({
        ...formValues,
        tagInput: value,
      })),
    [],
  );

  const setTags = useCallback((tagF) => {
    setFormValues(({ tags, ...formValues }) => ({ ...formValues, tags: tagF(tags) }));
  }, []);
  const addTag = useCallback((tag) => {
    setTags((tags) => [...tags, tag]);
    setTagInput('');
  }, []);
  const addTagText = useCallback((tag) => tag.trim() && addTag({ text: tag.trim(), id: tag.trim() }), [addTag]);
  const deleteTag = useCallback((tagIndex) => {
    setTags((tags) => tags.filter((tag, i) => i !== tagIndex));
  }, []);
  const reorderTag = useCallback((tag, currIndex, newIndex) => {
    setTags((tags) => arrayMove(tags, currIndex, newIndex));
  }, []);

  const handleChange = useCallback((event) => {
    const target = event.target;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const name = target.name;

    setFormValues((formValues) => ({
      ...formValues,
      [name]: value,
    }));
  }, []);

  const saveChanges = useCallback(async () => {
    const colors = [...'WUBRG'].filter((color) => formValues[`color${color}`]);
    const updated = { ...formValues, colors };
    for (const color of [...'WUBRG']) {
      delete updated[`color${color}`];
    }
    if (updated.imgUrl === '') {
      updated.imgUrl = null;
    }
    updated.cardID = updated.version;
    delete updated.version;
    updated.tags = updated.tags.map((tag) => tag.text);

    if (cardsAreEquivalent(updated, card) && updated.imgUrl === card.imgUrl) {
      // no need to sync
      closeCardModal();
      return;
    }

    try {
      if (!maybe) {
        const response = await csrfFetch(`/cube/api/updatecard/${cubeID}`, {
          method: 'POST',
          body: JSON.stringify({ src: card, updated }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const json = await response.json();
        if (json.success === 'true') {
          const cardResponse = await fetch(`/cube/api/getcardfromid/${updated.cardID}`);
          const cardJson = await cardResponse.json();

          const newCard = {
            ...card,
            ...updated,
            details: cardJson.card,
          };
          updateCubeCard(cardIndex, newCard);
          setIsOpen(false);
        }
      } else {
        const response = await csrfFetch(`/cube/api/maybe/update/${cubeID}`, {
          method: 'POST',
          body: JSON.stringify({ id: card._id, updated }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const json = await response.json();

        if (json.success === 'true') {
          const newCard = {
            ...card,
            ...updated,
          };
          if (json.details) {
            newCard.details = json.details;
          }
          updateMaybeboardCard(newCard);
          setIsOpen(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [card, formValues, updateCubeCard, updateMaybeboardCard]);

  const queueRemoveCard = useCallback(() => {
    addChange({
      remove: card,
    });
    setIsOpen(false);
  }, [card, addChange]);

  const openCardModal = useCallback(
    async (newCardIndex, newMaybe) => {
      const card = newMaybe ? maybeboard[newCardIndex] : cube.cards[newCardIndex];
      const colors = card.colors || card.details.colors;
      const typeLine = card.type_line || card.details.type;
      const tags = card.tags || [];
      setCardIndex(newCardIndex);
      setMaybe(!!newMaybe);
      setVersions([card.details]);
      setVersionsLoading(true);
      setFormValues({
        version: card.cardID,
        status: card.status,
        finish: card.finish,
        cmc: card.cmc,
        type_line: typeLine,
        imgUrl: card.imgUrl,
        tags: tags.map((tag) => ({ id: tag, text: tag })),
        tagInput: '',
        colorW: colors.includes('W'),
        colorU: colors.includes('U'),
        colorB: colors.includes('B'),
        colorR: colors.includes('R'),
        colorG: colors.includes('G'),
      });
      setIsOpen(true);
      const response = await fetch(`/cube/api/getversions/${card.cardID}`);
      const json = await response.json();
      setVersions(json.cards);
      setVersionsLoading(false);
    },
    [cube, maybeboard],
  );

  const closeCardModal = useCallback(() => setIsOpen(false));

  const details = versions.find((version) => version._id === formValues.version) || card.details;
  const renderCard = { ...card, details };
  return (
    <CardModalContext.Provider value={openCardModal}>
      {children}
      <CardModal
        values={formValues}
        onChange={handleChange}
        card={renderCard}
        maybe={maybe}
        versions={versions}
        versionsLoading={versionsLoading}
        toggle={closeCardModal}
        isOpen={isOpen}
        disabled={!canEdit}
        saveChanges={saveChanges}
        queueRemoveCard={queueRemoveCard}
        setTagInput={setTagInput}
        addTagText={addTagText}
        tagActions={{ addTag, deleteTag, reorderTag }}
        {...props}
      />
    </CardModalContext.Provider>
  );
};

export default CardModalForm;
