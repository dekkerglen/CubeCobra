import React, { Component } from 'react';

import { csrfFetch } from '../util/CSRF';

import CardModal from './CardModal';
import CardModalContext from './CardModalContext';

class CardModalForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      card: { details: {}, colors: [] },
      versions: [],
      isOpen: false,
      formValues: { tags: [] },
    }

    this.changeCardVersion = this.changeCardVersion.bind(this);
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
      }
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
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState(({ formValues }) => ({
      formValues: {
        ...formValues,
        [name]: value,
      }
    }));

    if (name === 'version') {
      // This should guarantee that version array is non-null.
      const { versions } = this.state;
      const newDetails = versions.find(version => version._id === value);
      if (versions.length > 0 && newDetails) {
        this.setState(({ card }) => ({
          card: {
            ...card,
            details: {
              ...newDetails,
              display_image: card.imgUrl || newDetails.image_normal,
            },
          }
        }));
      } else {
        console.error('Can\'t find version');
      }
    }
  }

  async saveChanges() {
    let colors = [...'WUBRG'].filter(color => this.state.formValues['color' + color]);
    let updated = { ...this.state.formValues, colors };
    for (let color of [...'WUBRG']) {
      delete updated['color' + color];
    }
    if (updated.imgUrl === '') {
      updated.imgUrl = null;
    }
    updated.cardID = updated.version;
    delete updated.version;
    updated.tags = updated.tags.map(tag => tag.text);

    let card = this.state.card;

    if (updated.cardID === card.cardID
      && updated.type_line === card.type_line
      && updated.status === card.status
      && updated.cmc === card.cmc
      && updated.imgUrl === card.imgUrl
      && updated.colors.join('') === card.colors.join('')
      && updated.tags.join(',') === card.tags.join(',')) {
      // no need to sync
      return;
    }

    let response = await csrfFetch('/cube/api/updatecard/' + document.getElementById('cubeID').value, {
      method: 'POST',
      body: JSON.stringify({ src: card, updated }),
      headers: {
        'Content-Type': 'application/json',
      }
    }).catch(err => console.error(err));
    let json = await response.json().catch(err => console.error(err));
    if (json.success === 'true') {
      let cardResponse = await fetch('/cube/api/getcardfromid/' + updated.cardID).catch(err => console.error(err));
      let cardJson = await cardResponse.json().catch(err => console.error(err));

      let index = card.index;
      let newCard = {
        ...cube[index],
        ...updated,
        index,
        details: {
          ...cardJson.card,
          display_image: updated.imgUrl || cardJson.card.image_normal,
        },
      };

      // magical incantation to get the global state right.
      cube[index] = newCard;
      cubeDict[cube[index].index] = newCard;
      this.setState({ card: newCard, isOpen: false });
      updateCubeList();
    }
  }

  queueRemoveCard() {
    // FIXME: Bring all this state inside React-world.
    changes.push({
      remove: this.state.card.details,
    });
    updateCollapse();
    $('#navedit').collapse("show");
    $('.warnings').collapse("hide");
    this.props.setOpenCollapse(() => 'edit');
    this.setState({ isOpen: false });
  }
 
  getCardVersions(card) {
    fetch('/cube/api/getversions/' + card.cardID)
      .then(response => response.json())
      .then(json => {
        // Otherwise the modal has changed in between.
        if (card.details.name == this.state.card.details.name) {
          this.setState({
            versions: json.cards,
          });
        }
      });
  }

  changeCardVersion(card) {
    this.setState({
      card,
      versions: [],
    });
  }

  openCardModal(card) {
    this.setState({
      card,
      versions: [],
      formValues: {
        version: card.cardID,
        status: card.status,
        cmc: card.cmc,
        type_line: card.type_line,
        imgUrl: card.imgUrl,
        tags: card.tags.map(tag => ({ id: tag, text: tag })),
        colorW: card.colors.includes('W'),
        colorU: card.colors.includes('U'),
        colorB: card.colors.includes('B'),
        colorR: card.colors.includes('R'),
        colorG: card.colors.includes('G'),
      },
      isOpen: true,
    });
    this.getCardVersions(card);
  }

  closeCardModal() {
    this.setState({ isOpen: false });
  }

  render() {
    let { canEdit, setOpenCollapse, children, ...props } = this.props;
    return (
      <CardModalContext.Provider value={this.openCardModal}>
        {children}
        <CardModal
          values={this.state.formValues}
          onChange={this.handleChange}
          card={this.state.card}
          versions={this.state.versions}
          toggle={this.closeCardModal}
          isOpen={this.state.isOpen}
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

export default CardModalForm;
