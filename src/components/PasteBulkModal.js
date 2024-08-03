import React, { useContext, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'contexts/CubeContext';

const PasteBulkModal = ({ isOpen, toggle }) => {
  const { cube } = useContext(CubeContext);
  const [text, setText] = useState('');

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="pasteBulkModalTitle">
      <ModalHeader id="pasteBulkModalTitle" toggle={toggle}>
        Bulk Upload - Paste Text
      </ModalHeader>
      <CSRFForm method="POST" action={`/cube/bulkupload/${cube.id}`} encType="multipart/form-data">
        <ModalBody>
          <p>
            Acceptable formats are:
            <br />• one card name per line, or
            <br />• one card name per line prepended with #x, such as &quot;2x island&quot;
          </p>
          <Input
            type="textarea"
            maxLength="20000"
            rows="10"
            placeholder="Paste Cube Here (max length 20000)"
            name="body"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="accent" type="submit">
            Upload
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

PasteBulkModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default PasteBulkModal;
