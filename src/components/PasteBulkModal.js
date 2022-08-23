import React, { useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';

import { Input, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import CubeContext from 'contexts/CubeContext';
import LoadingButton from 'components/LoadingButton';

const PasteBulkModal = ({ isOpen, toggle }) => {
  const { cube } = useContext(CubeContext);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState([]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="pasteBulkModalTitle">
      <ModalHeader id="pasteBulkModalTitle" toggle={toggle}>
        Bulk Upload - Paste Text
      </ModalHeader>
      <ModalBody>
        <p>
          Acceptable formats are:
          <br />• one card name per line, or
          <br />• one card name per line prepended with #x, such as &quot;2x island&quot;
        </p>
        {errors.length > 0 && (
          <div className="alert alert-danger">
            Please fix the following errors:
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
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
        <LoadingButton color="accent" block outline onClick={handleApply}>
          Apply
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};

PasteBulkModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default PasteBulkModal;
