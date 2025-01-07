import React, { useContext, useMemo, useState } from 'react';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Spinner from '../base/Spinner';
import CaptchaContext from '../../contexts/CaptchaContext';
import ReCAPTCHA from 'react-google-recaptcha';

import CSRFForm from '../CSRFForm';
import ChallengeInput, { generateChallenge } from '../forms/ChallengeInput';
import UserContext from '../../contexts/UserContext';

type Props = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

const CreateCubeModal: React.FC<Props> = ({ isOpen, setOpen }) => {
  const user = useContext(UserContext);
  const captchaSiteKey = useContext(CaptchaContext);
  const [loading, setLoading] = useState(false);
  const formRef = React.createRef<HTMLFormElement>();
  const [name, setName] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [answer, setAnswer] = useState('');
  const challenge = useMemo(() => generateChallenge(), []);

  const formData = useMemo(
    () => ({ name, captcha, question: challenge.question, answer }),
    [name, captcha, challenge, answer],
  );

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Create New Cube</ModalHeader>
      <CSRFForm ref={formRef} method="POST" action="/cube/add" formData={formData}>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Input
              label="Cube name:"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={1000}
              name="name"
              type="text"
            />
            <ChallengeInput question={challenge.question} answer={answer} setAnswer={setAnswer} name="answer" />
            <ReCAPTCHA
              sitekey={captchaSiteKey}
              onChange={(value) => setCaptcha(value || '')}
              theme={user?.theme === 'dark' ? 'dark' : 'light'}
            />
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          {loading ? (
            <div className="text-center min-w-full">
              <Spinner />
            </div>
          ) : (
            <Button
              type="submit"
              block
              color="primary"
              onClick={() => {
                setLoading(true);
                formRef.current?.submit();
              }}
            >
              Create
            </Button>
          )}
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default CreateCubeModal;
