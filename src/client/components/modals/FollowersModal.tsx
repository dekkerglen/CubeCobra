import React from 'react';

import { Col, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import UserPreview from 'components/UserPreview';
import User from 'datatypes/User';

interface FollowersModalProps {
  followers: User[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const FollowersModal: React.FC<FollowersModalProps> = ({ followers, isOpen, setOpen }) => (
  <Modal lg isOpen={isOpen} setOpen={setOpen}>
    <ModalHeader setOpen={setOpen}>
      <Text semibold lg>
        Followers
      </Text>
    </ModalHeader>
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

export default FollowersModal;
