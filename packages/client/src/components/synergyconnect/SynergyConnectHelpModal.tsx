import React from 'react';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';

export interface SynergyConnectHelpModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const SynergyConnectHelpModal: React.FC<SynergyConnectHelpModalProps> = ({ isOpen, setOpen }) => (
  <Modal isOpen={isOpen} setOpen={setOpen} sm scrollable>
    <ModalHeader setOpen={setOpen}>
      <Text semibold lg>
        How to play
      </Text>
    </ModalHeader>
    <ModalBody scrollable>
      <Flexbox direction="col" gap="3">
        <Text sm>
          In Synergy Connect, you need to find the four groupings of four cards. Each group is themed by a single
          legendary creature, and the four cards in a group all have high synergy with that legend.
        </Text>

        <Flexbox direction="col" gap="1">
          <Text sm semibold>
            What is Synergy?
          </Text>
          <Text sm className="text-text-secondary">
            Synergy is an emergent property from the machine learning model that powers our card recommendations and
            draft bots. It isn't a score of how common cards are found with each other, as that would surface popular
            cards like Lightning Bolt as having high synergy with every card. Instead, you will find cards having high
            synergy if they belong in the same archetype, or are part of a combo, or perhaps something else the model
            sees that we don't!
          </Text>
        </Flexbox>

        <Flexbox direction="col" gap="1">
          <Text sm semibold>
            How are the puzzles made?
          </Text>
          <Text sm className="text-text-secondary">
            We algorithmically generate these puzzles by randomizing some constraint, and then getting four legendary
            creatures that match that constraint that have low synergy with each other. This helps keep the groups
            reasonably distinct. The groupings don't contain the legendary creature, but instead the algorithm chooses
            four high synergy cards that also don't appear as high synergy cards for the other groups.
          </Text>
        </Flexbox>

        <Text sm className="text-text-secondary">
          A new puzzle is posted every day. Log in to keep a streak and see your past games in the archive.
        </Text>
      </Flexbox>
    </ModalBody>
    <ModalFooter>
      <Button color="primary" onClick={() => setOpen(false)} block>
        Got it
      </Button>
    </ModalFooter>
  </Modal>
);

export default SynergyConnectHelpModal;
