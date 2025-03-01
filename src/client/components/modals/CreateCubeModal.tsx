import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';

import ReCAPTCHA from 'react-google-recaptcha';

import CaptchaContext from '../../contexts/CaptchaContext';
import UserContext from '../../contexts/UserContext';
import Alert, { UncontrolledAlertProps } from '../base/Alert';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Spinner from '../base/Spinner';
import CSRFForm from '../CSRFForm';
import ChallengeInput, { generateChallenge } from '../forms/ChallengeInput';

type Props = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

const CreateCubeModal: React.FC<Props> = ({ isOpen, setOpen }) => {
  const user = useContext(UserContext);
  const captchaSiteKey = useContext(CaptchaContext);
  const [loading, setLoading] = useState(false);
  //useRef creates a reference that persists between renders, necessary for it to have a value within setTimeout
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [isNameValid, setNameValid] = useState(true);
  const [captcha, setCaptcha] = useState('');
  const [answer, setAnswer] = useState('');
  const challenge = useMemo(() => generateChallenge(), []);
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);

  const formData = useMemo(
    () => ({ name, captcha, question: challenge.question, answer }),
    [name, captcha, challenge, answer],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setAlerts([]); // Clear alerts first

      // Add a small delay to ensure the UI updates before showing new alerts
      setTimeout(() => {
        // Check form validity
        if (formRef.current?.checkValidity()) {
          if (captcha) {
            setLoading(true);
            formRef.current?.submit();
          } else {
            setAlerts([{ color: 'danger', message: 'Please complete the CAPTCHA' }]);
          }
        } else {
          // Trigger native browser validation UI
          formRef.current?.reportValidity();
        }
      }, 0);
    },
    [formRef, captcha],
  );

  const setCaptchaWrapper = useCallback((value: string | null) => {
    setAlerts([]);
    setCaptcha(value || '');
  }, []);

  const onCubeNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    setName(input.value);
    if (input.validity.tooShort) {
      setNameValid(false);
      input.setCustomValidity('Cube name must be between 5 and 100 characters long.');
    } else {
      setNameValid(true);
      input.setCustomValidity('');
    }
  }, []);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Create New Cube</ModalHeader>
      <CSRFForm ref={formRef} method="POST" action="/cube/add" formData={formData}>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Input
              label="Cube name:"
              value={name}
              onChange={onCubeNameChange}
              type="text"
              otherInputProps={{
                required: true,
                minLength: 5,
                maxLength: 100,
              }}
              valid={isNameValid}
            />
            <ChallengeInput question={challenge.question} answer={answer} setAnswer={setAnswer} name="answer" />
            <ReCAPTCHA
              sitekey={captchaSiteKey}
              onChange={setCaptchaWrapper}
              theme={user?.theme === 'dark' ? 'dark' : 'light'}
            />
            {alerts.map(({ color, message }) => (
              <Alert key={message} color={color} className="mt-2">
                {message}
              </Alert>
            ))}
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          {loading ? (
            <div className="text-center min-w-full">
              <Spinner />
            </div>
          ) : (
            <Button type="submit" block color="primary" onClick={handleSubmit}>
              Create
            </Button>
          )}
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default CreateCubeModal;
