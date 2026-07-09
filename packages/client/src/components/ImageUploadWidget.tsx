import React, { useContext, useRef, useState } from 'react';

import { UploadIcon } from '@primer/octicons-react';
import HostedImage, { HostedImageUsage } from '@utils/datatypes/HostedImage';
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from '@utils/hostedImagesUtil';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';

interface ImageUploadWidgetProps {
  // Called with the created HostedImage record after a successful upload.
  onUploaded: (image: HostedImage) => void;
  // Origin hint stored with the image.
  usage?: HostedImageUsage;
  // Optional label for the upload button.
  label?: string;
}

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

const ImageUploadWidget: React.FC<ImageUploadWidgetProps> = ({
  onUploaded,
  usage = 'general',
  label = 'Upload Image',
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError('Unsupported image type. Allowed: JPG, PNG, WebP, GIF.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Image is too large. Maximum size is ${MAX_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('usage', usage);
      formData.append('name', file.name);

      // Note: don't set Content-Type; the browser sets the multipart boundary.
      const response = await csrfFetch('/user/images/upload', {
        method: 'POST',
        body: formData,
      });

      // The global upload limit can reject oversized bodies with a plain-text 413 before the
      // route runs, so don't assume the response is JSON.
      if (response.status === 413) {
        setError(`Image is too large. Maximum size is ${MAX_MB}MB.`);
        return;
      }

      const body = await response.json().catch(() => null);
      if (response.ok && body?.success === 'true') {
        onUploaded(body.image as HostedImage);
      } else {
        setError(body?.message || 'Upload failed.');
      }
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  return (
    <Flexbox direction="col" gap="2">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
          }
        }}
      />
      <Button color="accent" disabled={uploading} onClick={() => fileRef.current?.click()}>
        <Flexbox direction="row" gap="2" alignItems="center" justify="center">
          {uploading ? <Spinner sm /> : <UploadIcon size={16} />}
          {uploading ? 'Uploading…' : label}
        </Flexbox>
      </Button>
      <Text sm className="text-text-secondary">
        JPG, PNG, WebP, or GIF. Up to {MAX_MB}MB. Images are converted to WebP and resized.
      </Text>
      {error && <Alert color="danger">{error}</Alert>}
    </Flexbox>
  );
};

export default ImageUploadWidget;
