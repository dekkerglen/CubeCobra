import React, { Component } from 'react';

import { csrfFetch } from '../util/CSRF';

import CardModal from './CardModal';
import CardModalContext from './CardModalContext';
import CubeContext from './CubeContext';

class CardModalFormRaw extends Component {
  constructor(props) {
    super(props);

    this.state = {
      card: { details: {}, colors: [] },
      versions: [],
      isOpen: false,
      formValues: { tags: [] },
    };

    this.openCardModal = this.openCardModal.bind(this);
    this.closeCardModal = this.closeCardModal.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.saveChanges = this.saveChanges.bind(this);
    this.queueRemoveCard = this.queueRemoveCard.bind(this);
    this.addTag = this.addTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.reorderTag = this.reorderTag.bind(this);
  }

  addTag(tag) {
    this.setState(({ formValues }) => ({
      formValues: {
        ...formValues,
        tags: [...formValues.tags, tag],
      },
    }));
  }

  deleteTag(tagIndex) {
    this.setState(({ formValues }) => ({
      formValues: {
        ...formValues,
        tags: formValues.tags.filter((tag, i) => i !== tagIndex),
      },
    }));
  }

  reorderTag(tag, currIndex, newIndex) {
    this.setState(({ formValues }) => {
      const tags = [...formValues.tags];
      tags.splice(currIndex, 1);
      tags.splice(newIndex, 0, tag);
      return {
        formValues: {
          ...formValues,
          tags,
        },
      };
    });
  }

  handleChange(event) {
    const { target } = event;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const { name } = target;

    this.setState(({ formValues }) => ({
      formValues: {
        ...formValues,
        [name]: value,
      },
    }));
  }

  async saveChanges() {
    const colors = [...'WUBRG'].filter((color) => this.state.formValues[`color${color}`]);
    const updated = { ...this.state.formValues, colors };
    for (const color of [...'WUBRG']) {
      delete updated[`color${color}`];
    }
    if (updated.imgUrl === '') {
      updated.imgUrl = null;
    }
    updated.cardID = updated.version;
    delete updated.version;
    updated.tags = updated.tags.map((tag) => tag.text);

    const { index } = this.state;
    const { cube } = this.props;
    const card = cube[index];

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

    const response = await csrfFetch(`/cube/api/updatecard/${document.getElementById('cubeID').value}`, {
      method: 'POST',
      body: JSON.stringify({ src: card, updated }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch((err) => console.error(err));
    const json = await response.json().catch((err) => console.error(err));
    if (json.success === 'true') {
      const cardResponse = await fetch(`/cube/api/getcardfromid/${updated.cardID}`).catch((err) => console.error(err));
      const cardJson = await cardResponse.json().catch((err) => console.error(err));

      const newCard = {
        ...card,
        ...updated,
        details: {
          ...cardJson.card,
          display_image: updated.imgUrl || cardJson.card.image_normal,
        },
      };
      this.props.updateCubeCard(index, newCard);
      this.setState({ card: newCard, isOpen: false });
    }
  }

  queueRemoveCard() {
    // FIXME: Bring all this state inside React-world.
    changes.push({
      remove: this.state.card.details,
    });
    updateCollapse();
    $('#navedit').collapse('show');
    $('.warnings').collapse('hide');
    this.props.setOpenCollapse(() => 'edit');
    this.setState({ isOpen: false });
  }

  openCardModal(index) {
    const { cube } = this.props;
    const card = cube[index];
    this.setState({
      index,
      versions: [card.details],
      formValues: {
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
      },
      isOpen: true,
    });
    fetch(`/cube/api/getversions/${card.cardID}`)
      .then((response) => response.json())
      .then((json) => {
        // Otherwise the modal has changed in between.
        if (card.details.name == this.props.cube[index].details.name) {
          this.setState({
            versions: json.cards,
          });
        }
      });
  }

  closeCardModal() {
    this.setState({ isOpen: false });
  }

  render() {
    const { canEdit, setOpenCollapse, children, cube, updateCubeCard, ...props } = this.props;
    const { index, isOpen, versions, formValues } = this.state;
    const baseCard = typeof index !== 'undefined' ? cube[index] : { details: {}, tags: [] };
    const details = versions.find(version => version._id === formValues.version) || baseCard.details;
    const card = { ...baseCard, details };
    return (
      <CardModalContext.Provider value={this.openCardModal}>
        {children}
        <CardModal
          values={formValues}
          onChange={this.handleChange}
          card={card}
          versions={versions}
          toggle={this.closeCardModal}
          isOpen={isOpen}
          disabled={!canEdit}
          saveChanges={this.saveChanges}
          queueRemoveCard={this.queueRemoveCard}
          tagActions={{
            addTag: this.addTag,
            deleteTag: this.deleteTag,
            reorderTag: this.reorderTag,
          }}
          {...props}
        />
      </CardModalContext.Provider>
    );
  }
}

const CardModalForm = (props) =>
  <CubeContext.Consumer>
    {({ cube, updateCubeCard }) =>
      <CardModalFormRaw {...{ cube, updateCubeCard}} {...props} />
    }
  </CubeContext.Consumer>;

export default CardModalForm;
