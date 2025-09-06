import React, { useCallback, useContext, useState } from 'react';

import { CSRFContext } from '../../contexts/CSRFContext';
import Alert from '../base/Alert';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Spinner from '../base/Spinner';
import Text from '../base/Text';

export interface P1P1DeleteModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  pack: { id: string };
  onDeleted?: (packId: string) => void;
  onDeleting?: () => void;
}

const P1P1DeleteModal: React.FC<P1P1DeleteModalProps> = ({ isOpen, setOpen, pack, onDeleted, onDeleting }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Immediately hide the pack from UI
    if (onDeleting) {
      onDeleting();
    }

    try {
      const response = await csrfFetch(`/tool/api/deletep1p1`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packId: pack.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete P1P1 pack');
      }

      // Handle successful deletion
      if (onDeleted) {
        onDeleted(pack.id);
      }
      setOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [csrfFetch, pack.id, onDeleted, onDeleting, setOpen]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>
        <Text lg semibold>
          Delete P1P1 Pack
        </Text>
      </ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="3">
          <Text>
            Are you sure you want to delete this P1P1 pack? This action cannot be undone and will remove all associated
            votes and comments.
          </Text>
          {error && (
            <Alert color="danger">
              <Text>{error}</Text>
            </Alert>
          )}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" justify="end">
          <Button color="secondary" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button color="danger" onClick={handleDelete} disabled={loading}>
            {loading ? <Spinner sm /> : 'Delete P1P1'}
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default P1P1DeleteModal;
