import React, { useCallback, useContext, useEffect, useState } from 'react';

import { CheckIcon, CopyIcon, PencilIcon, TrashIcon } from '@primer/octicons-react';
import HostedImage from '@utils/datatypes/HostedImage';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import ImageUploadWidget from 'components/ImageUploadWidget';
import { CSRFContext } from 'contexts/CSRFContext';

interface Usage {
  count: number;
  bytes: number;
}
interface Limits {
  maxImages: number;
  maxBytes: number;
}

const formatMB = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

const UserHostedImages: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const [images, setImages] = useState<HostedImage[]>([]);
  const [usage, setUsage] = useState<Usage>({ count: 0, bytes: 0 });
  const [limits, setLimits] = useState<Limits>({ maxImages: 0, maxBytes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [renaming, setRenaming] = useState<HostedImage | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<HostedImage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch('/user/images/list', { method: 'GET' });
      const body = await response.json();
      if (response.ok && body.success === 'true') {
        setImages(body.images);
        setUsage(body.usage);
        setLimits(body.limits);
      } else {
        setError(body.message || 'Could not load your images.');
      }
    } catch {
      setError('Could not load your images.');
    } finally {
      setLoading(false);
    }
  }, [csrfFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const onUploaded = useCallback((image: HostedImage) => {
    setImages((prev) => [image, ...prev]);
    setUsage((prev) => ({ count: prev.count + 1, bytes: prev.bytes + (image.bytes || 0) }));
  }, []);

  const copyUrl = useCallback(async (image: HostedImage) => {
    try {
      await navigator.clipboard.writeText(image.url);
      setCopiedId(image.id);
      setTimeout(() => setCopiedId((cur) => (cur === image.id ? null : cur)), 1500);
    } catch {
      // ignore clipboard failures
    }
  }, []);

  const submitRename = useCallback(async () => {
    if (!renaming) return;
    const response = await csrfFetch('/user/images/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: renaming.id, name: renameValue }),
    });
    const body = await response.json();
    if (response.ok && body.success === 'true') {
      setImages((prev) => prev.map((img) => (img.id === renaming.id ? body.image : img)));
      setRenaming(null);
    } else {
      setError(body.message || 'Could not rename the image.');
      setRenaming(null);
    }
  }, [csrfFetch, renaming, renameValue]);

  const confirmDelete = useCallback(async () => {
    if (!deleting) return;
    const target = deleting;
    const response = await csrfFetch('/user/images/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id }),
    });
    const body = await response.json();
    if (response.ok && body.success === 'true') {
      setImages((prev) => prev.filter((img) => img.id !== target.id));
      setUsage((prev) => ({ count: Math.max(0, prev.count - 1), bytes: Math.max(0, prev.bytes - (target.bytes || 0)) }));
      setDeleting(null);
    } else {
      setError(body.message || 'Could not delete the image.');
      setDeleting(null);
    }
  }, [csrfFetch, deleting]);

  return (
    <Flexbox direction="col" gap="3">
      <Text sm className="text-text-secondary">
        Upload and manage images hosted on Cube Cobra. Use their URLs as custom card art, or set them
        as your profile or cube image.
      </Text>

      <ImageUploadWidget onUploaded={onUploaded} usage="general" label="Upload New Image" />

      {limits.maxImages > 0 && (
        <Text sm className="text-text-secondary">
          Using {usage.count} / {limits.maxImages} images and {formatMB(usage.bytes)}MB /{' '}
          {formatMB(limits.maxBytes)}MB of storage.
        </Text>
      )}

      {error && <Alert color="danger">{error}</Alert>}

      {loading ? (
        <Flexbox direction="row" justify="center" className="py-4">
          <Spinner />
        </Flexbox>
      ) : images.length === 0 ? (
        <Text className="text-text-secondary">You have not uploaded any images yet.</Text>
      ) : (
        <Row>
          {images.map((image) => (
            <Col key={image.id} xs={6} md={4} className="mb-3">
              <Card>
                <img
                  src={image.url}
                  alt={image.name || 'Hosted image'}
                  className="w-full h-40 object-contain bg-bg-accent rounded-t"
                />
                <CardBody>
                  <Flexbox direction="col" gap="2">
                    <Text sm semibold className="truncate">
                      {image.name || 'Untitled'}
                    </Text>
                    <Flexbox direction="row" gap="1" wrap="wrap">
                      <Button color="secondary" onClick={() => copyUrl(image)}>
                        <Flexbox direction="row" gap="1" alignItems="center">
                          {copiedId === image.id ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                          {copiedId === image.id ? 'Copied' : 'Copy URL'}
                        </Flexbox>
                      </Button>
                      <Button
                        color="secondary"
                        onClick={() => {
                          setRenaming(image);
                          setRenameValue(image.name || '');
                        }}
                      >
                        <PencilIcon size={14} />
                      </Button>
                      <Button color="danger" onClick={() => setDeleting(image)}>
                        <TrashIcon size={14} />
                      </Button>
                    </Flexbox>
                  </Flexbox>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal isOpen={!!renaming} setOpen={(open) => !open && setRenaming(null)} sm>
        <ModalHeader setOpen={(open) => !open && setRenaming(null)}>Rename Image</ModalHeader>
        <ModalBody>
          <Input
            label="Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="A label to help you find this image"
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
          <Button color="primary" onClick={submitRename}>
            Save
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={!!deleting} setOpen={(open) => !open && setDeleting(null)} sm>
        <ModalHeader setOpen={(open) => !open && setDeleting(null)}>Delete Image</ModalHeader>
        <ModalBody>
          <Alert color="warning">
            Deleting this image may break any cards, cubes, or profiles that link to it. This cannot be
            undone.
          </Alert>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button color="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </Flexbox>
  );
};

export default UserHostedImages;
