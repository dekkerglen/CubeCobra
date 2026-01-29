import React from 'react';

import { PasteIcon } from '@primer/octicons-react';
import QRCode from 'react-qr-code';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';

interface CubeIdModalProps {
  setOpen: (open: boolean) => void;
  isOpen: boolean;
  shortId: string;
  fullID: string;
  cubeUrl: string;
  cubeName: string;
  alert: (type: string, message: string) => void;
}

const CubeIdModal: React.FC<CubeIdModalProps> = ({ setOpen, isOpen, shortId, fullID, cubeUrl, cubeName, alert }) => {
  const onCopyClick = async (id: string, label: string) => {
    await navigator.clipboard.writeText(id);
    alert('success', `${label} copied to clipboard`);
    setOpen(false);
  };

  const saveQRImage = () => {
    const svg = document.getElementById('qr-code') as HTMLElement;
    const data = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([data], { type: 'image/svg+xml' });

    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(svgBlob);
    a.download = `QR-${cubeName.replace(/\s/g, '_')}.svg`;
    a.click();
  };

  const shortIdUrl = `${cubeUrl.split('/cube/list/')[0]}/cube/list/${shortId}`;
  const durableUrl = `${cubeUrl.split('/cube/list/')[0]}/cube/list/${fullID}`;
  const qrUrl = `${cubeUrl.split('/cube/list/')[0]}/c/${shortId}`;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Share Cube</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text semibold sm>
            Share Link
          </Text>
          <Flexbox direction="row" gap="2" className="mb-2">
            <Input className="monospaced" value={shortIdUrl} disabled onChange={() => {}} />
            <Button
              className="btn-sm input-group-button"
              onClick={() => onCopyClick(shortIdUrl, 'Link')}
              aria-label="Copy share link"
            >
              <PasteIcon size={16} />
            </Button>
          </Flexbox>
          <Text sm>Share this link to let others view your cube.</Text>
          <Text semibold sm>
            Durable Share Link
          </Text>
          <Flexbox direction="row" gap="2" className="mb-2">
            <Input className="monospaced" value={durableUrl} disabled onChange={() => {}} />
            <Button
              className="btn-sm input-group-button"
              onClick={() => onCopyClick(durableUrl, 'Durable Link')}
              aria-label="Copy durable share link"
            >
              <PasteIcon size={16} />
            </Button>
          </Flexbox>
          <Text sm>This link uses the canonical ID and will never change, even if the short ID is modified.</Text>
          <Text semibold sm>
            QR Code
          </Text>
          <div className="flex justify-center p-3">
            <QRCode id="qr-code" value={qrUrl} size={200} />
          </div>
          <Button block color="accent" onClick={saveQRImage}>
            Download QR Code
          </Button>
          <Text semibold sm>
            Short ID
          </Text>
          <Flexbox direction="row" gap="2" className="mb-2">
            <Input className="monospaced" value={shortId} disabled onChange={() => {}} />
            <Button
              className="btn-sm input-group-button"
              onClick={() => onCopyClick(shortId, 'short ID')}
              aria-label="Copy short ID"
            >
              <PasteIcon size={16} />
            </Button>
          </Flexbox>
          <Text sm>A custom, memorable ID that owners are allowed to modify.</Text>
          <Text semibold sm>
            Full ID
          </Text>
          <Flexbox direction="row" gap="2" className="mb-2">
            <Input className="monospaced" value={fullID} disabled onChange={() => {}} />
            <Button
              className="btn-sm input-group-button"
              onClick={() => onCopyClick(fullID, 'Full ID')}
              aria-label="Copy Full ID"
            >
              <PasteIcon size={16} />
            </Button>
          </Flexbox>
          <Text sm>The canonical unique ID for this cube, guaranteed not to change.</Text>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={() => setOpen(false)} block>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CubeIdModal;
