import React, { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardGrid from 'components/card/CardGrid';
import { arrayShuffle } from 'utils/Util';
import Card from 'datatypes/Card';
import Button from 'components/base/Button';

interface SampleHandModalProps {
  deck: Card[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const SampleHandModal: React.FC<SampleHandModalProps> = ({ deck, isOpen, setOpen }) => {
  const [hand, setHand] = useState<Card[]>([]);
  const [pool, setPool] = useState<Card[]>([]);

  const refresh = () => {
    const newPool: Card[] = [...deck];

    arrayShuffle(newPool);
    const newHand = newPool.splice(0, Math.min(7, newPool.length));

    setHand(newHand);
    setPool(newPool);
  };

  const draw = () => {
    if (pool.length > 0) {
      const newPool = [...pool];
      const newHand = [...hand, newPool.splice(0, 1)[0]];

      setHand(newHand);
      setPool(newPool);
    }
  };

  const close = () => {
    setOpen(false);
  };

  useEffect(() => {
    refresh();
  }, [deck]);

  return (
    <Modal xl isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Sample Hand
        </Text>
      </ModalHeader>
      <ModalBody className="p-4">
        <CardGrid cards={hand} xs={3} md={4} lg={7} />
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" className="w-full" justify="between" gap="2">
          <Button block color="primary" onClick={refresh}>
            New Hand
          </Button>
          <Button block color="accent" onClick={draw}>
            Draw One Card
          </Button>
          <Button block color="secondary" onClick={close}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default SampleHandModal;
