import React, { useCallback, useContext, useState } from 'react';

import { csrfFetch } from '../util/CSRF';
import { arrayMove } from '../util/Util';

import CardModal from './CardModal';
import CardModalContext from './CardModalContext';
import ChangelistContext from './ChangelistContext';
import CubeContext from './CubeContext';

const CardModalForm = ({ canEdit, setOpenCollapse, children, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cardIndex, setCardIndex] = useState(null);
  const [versions, setVersions] = useState([]);
  const [formValues, setFormValues] = useState({ tags: [] });

  const { addChange } = useContext(ChangelistContext);
  const { cube, updateCubeCard } = useContext(CubeContext);

  const card = cube[cardIndex] || { colors: [], details: {}, tags: [] };

  const setTags = useCallback((tagF) => {
    setFormValues(({ tags, ...formValues }) => ({ ...formValues, tags: tagF(tags) }));
  });
  const addTag = useCallback((tag) => setTags(tags => [...tags, tag]));
  const deleteTag = useCallback((tagIndex) => {
    setTags(tags => tags.filter((tag, i) => i !== tagIndex));
  });
  const reorderTag = useCallback((tag, currIndex, newIndex) => {
    setTags(tags => arrayMove(tags, currIndex, newIndex));
  });

  const handleChange = useCallback((event) => {
    const target = event.target;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const name = target.name;

    setFormValues(formValues => ({
      ...formValues,
      [name]: value,
    }));
  });

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

    if (
      updated.cardID === card.cardID &&
      updated.type_line === card.type_line &&
      updated.status === card.status &&
      updated.cmc === card.cmc &&
      updated.imgUrl === card.imgUrl &&
      updated.colors.join('') === card.colors.join('') &&
      updated.tags.join(',') === card.tags.join(',') &&
      updated.finish === card.finish
    ) {
      // no need to sync
      return;
    }

    try {
      const response = await csrfFetch(`/cube/api/updatecard/${document.getElementById('cubeID').value}`, {
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
          details: {
            ...cardJson.card,
            display_image: updated.imgUrl || cardJson.card.image_normal,
          },
        };
        updateCubeCard(cardIndex, newCard);
        setIsOpen(false);
      }
    } catch(e) {
      console.error(e);
    }
  }, [card, formValues, updateCubeCard]);

  const queueRemoveCard = useCallback(() => {
    addChange({
      remove: card.details,
    });
    setOpenCollapse(() => 'edit');
    setIsOpen(false);
  }, [card, addChange, setOpenCollapse]);

  const openCardModal = useCallback((newCardIndex) => {
    const card = cube[newCardIndex];
    setCardIndex(newCardIndex);
    setVersions([card.details]);
    setFormValues({
      version: card.cardID,
      status: card.status,
      finish: card.finish,
      cmc: card.cmc,
      type_line: card.type_line,
      imgUrl: card.imgUrl,
      tags: card.tags.map((tag) => ({ id: tag, text: tag })),
      colorW: card.colors.includes('W'),
      colorU: card.colors.includes('U'),
      colorB: card.colors.includes('B'),
      colorR: card.colors.includes('R'),
      colorG: card.colors.includes('G'),
    });
    setIsOpen(true);
    const currentCard = card;
    fetch(`/cube/api/getversions/${card.cardID}`)
      .then((response) => response.json())
      .then((json) => {
        // Otherwise the modal has changed in between.
        if (currentCard.details.name == cube[newCardIndex].details.name) {
          setVersions(json.cards);
        }
      });
  }, [cube]);

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
        versions={versions}
        toggle={closeCardModal}
        isOpen={isOpen}
        disabled={!canEdit}
        saveChanges={saveChanges}
        queueRemoveCard={queueRemoveCard}
        tagActions={{ addTag, deleteTag, reorderTag }}
        {...props}
      />
    </CardModalContext.Provider>
  );
}

export default CardModalForm;
