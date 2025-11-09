import React from 'react';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import RotoDraftContext from 'contexts/RotoDraftContext';

type Props = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

//"https://docs.google.com/spreadsheets/d/e/2PACX-1vQDppSsyG4ZaBKAKHmAIHmqKrehXhmibeWKclaQl5EalYbQK_RMXIPrpwRDUoZnSz0vAM91t4iKjgN0/pub?gid=1822506900&single=true&output=csv"

const RotisserieDraftModal: React.FC<Props> = ({ isOpen, setOpen }) => {
  const { setUrl: setContextUrl } = React.useContext(RotoDraftContext);
  const [url, setUrl] = React.useState('');

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Rotisserie Draft Setup</ModalHeader>
      <ModalBody>
        <Flexbox gap="2" direction="col">
          <p>
            Start by reading{' '}
            <Link href="https://luckypaper.co/resources/formats/rotisserie/" target="_blank">
              Lucky Paper's article
            </Link>{' '}
            about Rotisserie draft!
          </p>
          <p>
            Once you have created your own copy of their Google Sheet and set it up with your chosen cube and players,
            you'll need to make the sheet accessible to CubeCobra.
          </p>
          <ol>
            <li>{`1. On your Google Sheet, navigate to File -> Share -> Publish to web and click it`}</li>
            <li>2. On the dropdown that says "Entire Document", select "Draft"</li>
            <li>{`3. On the dropdown that says "Web page", select "Comma-separated values (.csv)"`}</li>
            <li>4. Click the "Publish" button</li>
            <li>5. Copy the URL it generates in the box and paste it into the box below</li>
          </ol>
          <Input
            label="Google Sheet CSV URL:"
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Button
          onClick={() => {
            setContextUrl(url);
            setOpen(false);
          }}
        >
          OK
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default RotisserieDraftModal;
