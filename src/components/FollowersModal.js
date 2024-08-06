import React from 'react';
import { Col, Modal, ModalBody, ModalHeader, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import UserPreview from 'components/UserPreview';

const FollowersModal = ({ followers, isOpen, toggle }) => (
  <Modal size="lg" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Followers</ModalHeader>
    <ModalBody>
      <Row className="justify-content-center">
        {followers.map((follower) => (
          <Col key={follower.id} xs={6} sm={4} lg={3}>
            <UserPreview user={follower} />
          </Col>
        ))}
      </Row>
    </ModalBody>
  </Modal>
);

FollowersModal.propTypes = {
  followers: PropTypes.arrayOf(UserPropType).isRequired,
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default FollowersModal;
