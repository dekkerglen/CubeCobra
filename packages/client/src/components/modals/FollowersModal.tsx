import React, { useCallback, useContext, useEffect, useState } from 'react';

import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import { Col, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import UserPreview from 'components/UserPreview';

import { CSRFContext } from '../../contexts/CSRFContext';

interface FollowersModalProps {
  id: string;
  type: 'cube' | 'user';
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const PAGE_SIZE = 100;

const FollowersModal: React.FC<FollowersModalProps> = ({ type, id, isOpen, setOpen }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [followers, setFollowers] = useState([] as User[]);
  const [fetched, setFetched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setFollowers([]);
      const res = await csrfFetch(`/api/followers/${type}/${id}?skip=0&limit=${PAGE_SIZE}`, {
        method: 'GET',
      });

      const json = await res.json();
      setFollowers(json.followers);
      setHasMore(json.hasMore);
      setFetched(true);
      setLoading(false);
    };

    //Only trigger if the modal is opened and if we haven't fetched yet
    if (isOpen && !fetched) {
      run();
    }
  }, [csrfFetch, type, id, isOpen, fetched]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const skip = followers.length;
    const res = await csrfFetch(`/api/followers/${type}/${id}?skip=${skip}&limit=${PAGE_SIZE}`, {
      method: 'GET',
    });

    const json = await res.json();
    setFollowers([...followers, ...json.followers]);
    setHasMore(json.hasMore);
    setLoading(false);
  }, [csrfFetch, type, id, followers]);

  return (
    <Modal lg isOpen={isOpen} setOpen={setOpen} scrollable>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Followers
        </Text>
      </ModalHeader>
      <ModalBody scrollable>
        <Row className="justify-content-center">
          {followers.map((follower) => (
            <Col key={follower.id} xs={6} sm={4} lg={3}>
              <UserPreview user={follower} />
            </Col>
          ))}
        </Row>
        {loading && <div>Loading...</div>}
        {hasMore && (
          <ModalFooter>
            <Button color="primary" block={true} type="button" onClick={loadMore}>
              <div className={`centered`}>Load more</div>
            </Button>
          </ModalFooter>
        )}
      </ModalBody>
    </Modal>
  );
};

export default FollowersModal;
