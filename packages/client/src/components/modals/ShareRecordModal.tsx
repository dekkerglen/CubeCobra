import React, { useCallback, useContext, useEffect, useState } from 'react';

import Record from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface ShareRecordModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

// Owner-only: reveals a tokenized link that lets anyone add their deck to this
// record. The token is fetched on demand (never embedded in the record page).
const ShareRecordModal: React.FC<ShareRecordModalProps> = ({ isOpen, setOpen, record }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLink(null);
    setError(null);
    setCopied(false);
    (async () => {
      try {
        const res = await csrfFetch(`/cube/records/sharetoken/${record.id}`, { method: 'GET' });
        const json = await res.json();
        if (json?.success && json.token) {
          setLink(
            `${window.location.origin}/cube/records/contribute/${record.id}?token=${encodeURIComponent(json.token)}`,
          );
        } else {
          setError('Could not generate a link.');
        }
      } catch {
        setError('Could not generate a link.');
      }
    })();
  }, [isOpen, csrfFetch, record.id]);

  const copy = useCallback(() => {
    if (link) {
      navigator.clipboard?.writeText(link);
      setCopied(true);
    }
  }, [link]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Share a link to collect decks</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text sm>
            Anyone with this link can add their deck and result to <strong>{record.name}</strong> — no access to your
            cube required. Treat it like a password; only share it with your players.
          </Text>
          {!link && !error && <Spinner sm />}
          {error && (
            <Text sm className="text-danger">
              {error}
            </Text>
          )}
          {link && (
            <Flexbox direction="row" gap="2" alignItems="center">
              <Input
                type="text"
                value={link}
                onChange={() => {}}
                otherInputProps={{
                  readOnly: true,
                  onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
                }}
              />
              <Button color="primary" onClick={copy}>
                <span className="text-nowrap">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </Flexbox>
          )}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" block onClick={() => setOpen(false)}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ShareRecordModal;
