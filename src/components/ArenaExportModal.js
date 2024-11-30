import React, { useContext, useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';

import CubeContext from 'contexts/CubeContext';
import { makeFilter } from 'filtering/FilterCards';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import { sortForDownload } from 'utils/Sort';

const ArenaExportModal = ({ isOpen, toggle, isFilterUsed, isSortUsed }) => {
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  const { cube, sortPrimary, sortSecondary, sortTertiary, sortQuaternary, filterInput } = useContext(CubeContext);

  const [text, setText] = useState('');

  const AFTERMATH_ORACLE_TEXT = 'Aftermath (Cast this spell only from your graveyard. Then exile it.)'.toLowerCase();

  const generateExport = useCallback(() => {
    generateArenaExport();
  }, [
    cube.cards.mainboard,
    isFilterUsed,
    isSortUsed,
    filterInput,
    sortPrimary,
    sortSecondary,
    sortTertiary,
    sortQuaternary,
  ]);

  /*
   * Based text format on information in https://magicarena.fandom.com/wiki/Deck_Import. Could not find a more definitive resource.
   * Known issues:
   * 1) Cards ending in ! (eg Fear, Fire, Foes!) are unable to import to Arena (even exporting from Arena then back in fails). See https://feedback.wizards.com/forums/918667-mtg-arena-bugs-product-suggestions/suggestions/46881610-can-t-import-deck-with-fear-fire-foes
   * 2) Meld back sides will fail to find in Arena. Don't see any information from Scryfall to distinguish from the meld front sides
   */
  async function generateArenaExport() {
    let cards = cube.cards.mainboard;
    if (isFilterUsed) {
      const { filter, err } = makeFilter(filterInput);
      if (err) {
        throw err;
      }
      if (filter) {
        cards = cards.filter(filter);
      }
    }

    let sortedCards = cards;
    if (isSortUsed) {
      sortedCards = sortForDownload(cards, sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube.showUnsorted);
    }

    let exportText = '';
    for (const card of sortedCards) {
      /*
       * While card set and collector number can be imported to Arena, if the set is not available on Arena (or if in a different set code than paper),
       * it causes a failure to import for the card name. Thus we omit the information even if it can be used.
       * Similar to the majority of the exports, treat each card in the cube as indepenent instead of counting by name to group.
       */
      exportText += `1 ${getCardNameForArena(card.details)}\n`;
    }

    setText(exportText);
  }

  function getCardNameForArena(cardDetails) {
    let name = cardDetails.name;
    const oracleText = cardDetails.oracle_text;

    /*
     * Arena import (bug?) requires aftermath cards to be separated by three slashes not two. Normal split cards (and/or rooms) with 2 slashes are fine.
     * Best logic found so far is to check the oracle text has the full Aftermath keyword/reminder text.
     */
    if (oracleText.toLowerCase().includes(AFTERMATH_ORACLE_TEXT)) {
      name = name.replaceAll('//', '///');
    }
    return name;
  }

  function closeAlert() {
    //Dimiss the copied to clipboard alert if it is present, so the next time the modal opens it is hidden
    dismissAlerts();
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(text);
    addAlert('success', 'Copied to clipboard successfully.');
  }

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      labelledBy="arenaExportModalTitle"
      onOpened={generateExport}
      onClosed={closeAlert}
    >
      <ModalHeader id="arenaExportModalTitle" toggle={toggle}>
        Arena Export
      </ModalHeader>
      <ModalBody>
        <p>Copy the textbox or use the Copy to clipboard button.</p>
        <p>Note: Arena can only import 250 cards into a deck.</p>
        <Alerts alerts={alerts} />
        <Input type="textarea" rows="10" name="body" value={text} readOnly="true" />
        <ModalFooter>
          <Button color="accent" onClick={copyToClipboard}>
            Copy to clipboard
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </ModalBody>
    </Modal>
  );
};

ArenaExportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  isFilterUsed: PropTypes.bool.isRequired,
  isSortUsed: PropTypes.bool.isRequired,
};

export default ArenaExportModal;
