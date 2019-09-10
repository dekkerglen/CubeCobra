import React, { Component } from 'react';

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
      allTags: [],
    }

    this.changeCardVersion = this.changeCardVersion.bind(this);
    this.openCardModal = this.openCardModal.bind(this);
    this.closeCardModal = this.closeCardModal.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.saveChanges = this.saveChanges.bind(this);
    this.queueRemoveCard = this.queueRemoveCard.bind(this);
    this.addTag = this.addTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
  }

  addTag(tag) {
    this.setState({
      formValues: Object.assign(this.state.formValues, {
        tags: [].concat(this.state.formValues.tags, tag),
      }),
      allTags: [].concat(this.state.allTags, tag),
    });
  }

  deleteTag(i) {
    let newTags = this.state.formValues.tags.slice(0);
    newTags.splice(i, 1);
    this.setState({
      formValues: Object.assign(this.state.formValues, {
        tags: newTags,
      }),
    });
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState(({ formValues, ...state }) => Object.assign(state, {
      formValues: Object.assign(formValues, {
        [name]: value
      })
    }));

    if (name === 'version') {
      fetch('/cube/api/getcardfromid/' + value)
        .then(response => response.json())
        .then(json => {
          if (json.success) {
            console.log(json);
            this.setState(({ card, ...state }) => Object.assign(state, {
              card: Object.assign(card, { details: json.card })
            }));
          }
        });
    }
  }

  async saveChanges() {
    let colors = ['W', 'U', 'B', 'R', 'G'].filter(color => this.state.formValues['color' + color]);
    let updated = Object.assign(this.state.formValues, { colors });
    for (let color of ['W', 'U', 'B', 'R', 'G']) {
      delete updated['color' + color];
    }
    if (updated.imgUrl === '') {
      updated.imgUrl = null;
    }
    updated.cardID = updated.version;
    updated.tags = updated.tags.map(tag => tag.name).join(',');

    let card = this.state.card;

    let response = await fetch('/cube/api/updatecard/' + document.getElementById('cubeID').value, {
      method: 'POST',
      body: JSON.stringify({ src: card, updated }),
      headers: {
        'Content-Type': 'application/json',
      }
    })
    let json = await response.json();
    if (json.success === 'true') {
      let cardResponse = await fetch('/cube/api/getcardfromid/' + updated.cardID);
      let cardJson = await cardResponse.json();

      let index = card.index;
      let newCard = Object.assign(updated, {
        index,
        details: Object.assign(cardJson.card, {
          display_image: updated.imgUrl,
        }),
      })

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
      version: [],
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
        tags: card.tags,
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
    let { children, canEdit, ...props } = this.props;
    return (
      <CardModalContext.Provider value={this.openCardModal}>
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
          addTag={this.addTag}
          deleteTag={this.deleteTag}
          allTags={this.state.allTags}
          {...props}
        />
        {children}
      </CardModalContext.Provider>
    );
  }
}

export default CardModalForm;
