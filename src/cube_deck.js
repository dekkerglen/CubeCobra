import React from 'react';
import ReactDOM from 'react-dom';

import DraftDeck from './components/DraftDeck';

const oldFormat = document.getElementById('oldformat').value === 'true';
const drafter = JSON.parse(document.getElementById('drafter').value);
const cards = JSON.parse(document.getElementById('cards').value);
const deck = JSON.parse(document.getElementById("deckraw").value);
const botDecks = JSON.parse(document.getElementById("botdecks").value);
const bots = JSON.parse(document.getElementById("bots").value);
const canEdit = document.getElementById('canEdit').value === 'true';
const element = <DraftDeck {...{ oldFormat, drafter, cards, deck, botDecks, bots }} />;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(element, wrapper) : false;
