import React from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';
import QRCode from 'react-qr-code';

const saveQRImage = (cubeName) => {
  const svg = document.getElementById('qr-code');
  const data = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([data], { type: 'image/svg+xml' });

  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(svgBlob);
  a.download = `QR-${cubeName.replace(/\s/g, '_')}.svg`;
  a.click();
};

const QRCodeModal = ({ isOpen, toggle, link, cubeName }) => (
  <Modal size="md" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Link to {cubeName}</ModalHeader>
    <ModalBody>
      <div className="centered">
        <div className="p-3 qr-code-area">
          <QRCode id="qr-code" value={link} />
        </div>
      </div>
    </ModalBody>
    <ModalFooter>
      <Button color="accent" onClick={() => saveQRImage(cubeName)}>
        Download
      </Button>
      <Button color="secondary" onClick={toggle}>
        Close
      </Button>
    </ModalFooter>
  </Modal>
);

QRCodeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  link: PropTypes.string.isRequired,
  cubeName: PropTypes.string.isRequired,
};

export default QRCodeModal;
