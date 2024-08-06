import React from 'react';
import { Button, Input, InputGroup, InputGroupText, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';

const ReportCommentModal = ({ comment, isOpen, toggle }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <CSRFForm method="POST" action="/comment/report" autoComplete="off">
        <ModalHeader toggle={toggle}>Report this Comment</ModalHeader>
        <ModalBody>
          <InputGroup className="mb-3">
            <InputGroupText>Report Reason:</InputGroupText>
            <Input type="select" id="reason" name="reason">
              <option>This is spam or phishing</option>
              <option>This is offensive or abusive</option>
              <option>It expresses intentions of self-harm or suicide</option>
            </Input>
          </InputGroup>
          <Input
            type="textarea"
            className="w-100"
            id="info"
            name="info"
            placeholder="Put any additional comments here."
          />
          <Input type="hidden" name="commentid" value={comment.id} />
        </ModalBody>
        <ModalFooter>
          <Button color="accent">Submit Report</Button>
          <Button color="unsafe" onClick={toggle}>
            Cancel
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

ReportCommentModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  comment: PropTypes.shape({
    id: PropTypes.number.isRequired,
  }).isRequired,
};

export default ReportCommentModal;
