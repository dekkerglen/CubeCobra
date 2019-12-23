import React from 'react';
import ReactDOM from 'react-dom';

import Deckbuilder from './components/Deckbuilder';

const deck = JSON.parse(document.getElementById("deckraw").value);
/* FIXME: Remove */ window.deck = deck;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<Deckbuilder initialDeck={deck} />, wrapper) : false;
