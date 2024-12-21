import React, { useContext, useMemo, useState } from 'react';
import CSRFForm from 'components/CSRFForm';
import Input from 'components/base/Input';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import ReCAPTCHA from 'react-google-recaptcha';
import CaptchaContext from 'contexts/CaptchaContext';
import ChallengeInput, { generateChallenge } from './ChallengeInput';

interface RegisterFormProps {
  email?: string;
  username?: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ email = '', username = '' }) => {
  const captchaSiteKey = useContext(CaptchaContext);
  const [currentEmail, setEmail] = useState(email);
  const [currentUsername, setUsername] = useState(username);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [captcha, setCaptcha] = useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const [answer, setAnswer] = useState('');
  const challenge = useMemo(() => generateChallenge(), []);

  const formData = useMemo(
    () => ({ captcha, email, username, password, password2, question: challenge.question, answer }),
    [email, username, password, password2, challenge, answer, captcha],
  );

  return (
    <CSRFForm ref={formRef} method="POST" action="/user/register" formData={formData}>
      <Flexbox direction="col" gap="2">
        <Input
          label="Email Address"
          maxLength={1000}
          name="email"
          id="email"
          type="text"
          value={currentEmail}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Username"
          maxLength={1000}
          name="username"
          id="username"
          type="text"
          value={currentUsername}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          label="Password"
          maxLength={1000}
          name="password"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm Password"
          maxLength={1000}
          name="password2"
          id="password2"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
        />
        <ChallengeInput question={challenge.question} answer={answer} setAnswer={setAnswer} name="answer" />
        <ReCAPTCHA sitekey={captchaSiteKey} onChange={(value) => setCaptcha(value || '')} />
        <Button color="primary" block onClick={() => formRef.current?.submit()}>
          Register
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default RegisterForm;
