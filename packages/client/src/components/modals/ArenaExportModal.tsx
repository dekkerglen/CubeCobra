import React, { useContext, useEffect, useState } from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import { sortForDownload } from '@utils/sorting/Sort';

import CubeContext from '../../contexts/CubeContext';
import FilterContext from '../../contexts/FilterContext';
import useAlerts, { Alerts } from '../../hooks/UseAlerts';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import TextArea from '../base/TextArea';

interface ArenaExportModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  isSortUsed: boolean;
  isFilterUsed: boolean;
}

const ArenaExportModal: React.FC<ArenaExportModalProps> = ({ isOpen, setOpen, isSortUsed, isFilterUsed }) => {
  const { alerts, addAlert, dismissAlerts } = useAlerts();
  const [text, setText] = useState('');
  const { cube, sortPrimary, sortSecondary, sortTertiary, sortQuaternary } = useContext(CubeContext);
  const { cardFilter } = useContext(FilterContext)!;

  //Generate the export text for the current cube cards, tracking all the cards, filters and sorts to ensure it only
  //generates when things change
  useEffect(() => {
    const AFTERMATH_ORACLE_TEXT = 'Aftermath (Cast this spell only from your graveyard. Then exile it.)'.toLowerCase();

    /*
     * Based text format on information in https://magicarena.fandom.com/wiki/Deck_Import. Could not find a more definitive resource.
     * Known issues:
     * 1) Cards ending in ! (eg Fear, Fire, Foes!) are unable to import to Arena (even exporting from Arena then back in fails). See https://feedback.wizards.com/forums/918667-mtg-arena-bugs-product-suggestions/suggestions/46881610-can-t-import-deck-with-fear-fire-foes
     * 2) Meld back sides will fail to find in Arena. Don't see any information from Scryfall to distinguish from the meld front sides
     */
    const generateArenaExport = () => {
      let cards = cube.cards.mainboard;
      if (isFilterUsed) {
        cards = cards.filter(cardFilter.filter);
      }

      let sortedCards = cards;
      if (isSortUsed) {
        //Use ?? in case the sorts are null. Undefined results in the defaults within sortForDownload being used
        sortedCards = sortForDownload(
          cards,
          sortPrimary ?? undefined,
          sortSecondary ?? undefined,
          sortTertiary ?? undefined,
          sortQuaternary ?? undefined,
          cube.showUnsorted,
        );
      }

      let exportText = '';
      for (const card of sortedCards) {
        if (typeof card.details === 'undefined') {
          continue;
        }
        /*
         * While card set and collector number can be imported to Arena, if the set is not available on Arena (or if in a different set code than paper),
         * it causes a failure to import for the card name. Thus we omit the information even if it can be used.
         * Similar to the majority of the exports, treat each card in the cube as indepenent instead of counting by name to group.
         */
        exportText += `1 ${getCardNameForArena(card.details)}\n`;
      }

      setText(exportText);
    };

    function getCardNameForArena(cardDetails: CardDetails) {
      let name = cardDetails.name;
      const oracleText = cardDetails.oracle_text;

      /*
       * Arena import (bug?) requires aftermath cards to be separated by three slashes not two. Normal split cards (and/or rooms) with 2 slashes are fine.
       * Best logic found so far is to check the oracle text has the full Aftermath keyword/reminder text.
       */
      if (oracleText.toLowerCase().includes(AFTERMATH_ORACLE_TEXT)) {
        name = name.replace(new RegExp('//', 'g'), '///');
      }
      return name;
    }

    generateArenaExport();
  }, [
    cube.cards.mainboard,
    isFilterUsed,
    isSortUsed,
    cardFilter,
    sortPrimary,
    sortSecondary,
    sortTertiary,
    sortQuaternary,
    cube.showUnsorted,
  ]);

  async function copyToClipboard() {
    //Dismiss any remaining alerts before adding the new one, so multiple don't stack up
    dismissAlerts();
    await navigator.clipboard.writeText(text);
    addAlert('success', 'Copied to clipboard successfully.');
    //Auto dismiss after a few seconds
    setTimeout(dismissAlerts, 3000);
  }

  function onClose() {
    setOpen(false);
    //Dismiss when closing the dialog so it opens in a fresh state
    dismissAlerts();
  }

  return (
    <Modal isOpen={isOpen} setOpen={onClose} md>
      <ModalHeader setOpen={onClose}>Arena Export</ModalHeader>
      <ModalBody>
        <Text>Copy the textbox or use the Copy to clipboard button.</Text>&nbsp;
        <Text>Note: Arena can only import 250 cards into a deck.</Text>
        <Alerts alerts={alerts} />
        <TextArea rows={10} placeholder="Copy Cube" value={text} disabled />
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <Button color="primary" block onClick={copyToClipboard}>
            Copy to clipboard
          </Button>
          <Button color="danger" onClick={onClose} block>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default ArenaExportModal;
