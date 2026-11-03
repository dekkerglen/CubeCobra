import React, { useCallback, useState } from 'react';

import { DeviceCameraIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { CardDetails } from '@utils/datatypes/Card';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalHeader } from 'components/base/Modal';

import UploadDeckFromPhoto from './UploadDeckFromPhoto';

interface ScanDeckPhotoButtonProps {
  cube: Cube;
  setMainboardCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  setSideboardCards?: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
}

// The scanner inline is a control until a photo is chosen, and then it is a full-width
// review surface: a photo, a spotlight overlay and a row per detected card. Sat in a column
// beside the paste box it had a fraction of the width that surface needs, and it pushed
// everything below it off the screen for the length of a scan that ends in a submit anyway.
const ScanDeckPhotoButton: React.FC<ScanDeckPhotoButtonProps> = ({
  cube,
  setMainboardCards,
  setSideboardCards,
  setAlerts,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  // The page's own alerts render behind the backdrop, so a partial scan's "3 couldn't be
  // resolved" would be announced where it cannot be read. Every alert is written to both
  // lists from the same updater, and the local one is dropped when the modal closes.
  const [alerts, setLocalAlerts] = useState<UncontrolledAlertProps[]>([]);

  const recordAlert: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>> = useCallback(
    (update) => {
      setLocalAlerts(update);
      setAlerts(update);
    },
    [setAlerts],
  );

  const close = useCallback(() => {
    setOpen(false);
    setLocalAlerts([]);
  }, []);

  return (
    <>
      <Button color="accent" onClick={() => setOpen(true)}>
        <Flexbox direction="row" alignItems="center" gap="1">
          <DeviceCameraIcon size={16} />
          <span className="text-nowrap">Scan deck from photo</span>
        </Flexbox>
      </Button>
      <Modal isOpen={open} setOpen={(value) => (value ? setOpen(true) : close())} xxl scrollable>
        <ModalHeader setOpen={(value) => (value ? setOpen(true) : close())}>Scan deck from photo</ModalHeader>
        <ModalBody scrollable>
          <Flexbox direction="col" gap="2">
            {alerts.map(({ color, message }, index) => (
              <Alert key={index} color={color}>
                {message}
              </Alert>
            ))}
            {/* Mounted only while open, so a scan's worker, canvases and decoded image are
                released when it closes rather than held for the life of the page. */}
            {open && (
              <UploadDeckFromPhoto
                bare
                cube={cube}
                setMainboardCards={setMainboardCards}
                setSideboardCards={setSideboardCards}
                setAlerts={recordAlert}
                onComplete={close}
              />
            )}
          </Flexbox>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ScanDeckPhotoButton;
