import React from 'react';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import LoginForm from 'components/forms/LoginForm';
import ResendVerificationForm from 'components/forms/ResendVerificationForm';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const LoginPage: React.FC = () => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const resendFormRef = React.useRef<HTMLFormElement>(null);
  const [showResendForm, setShowResendForm] = React.useState(false);

  // Check if there's a verification error in flash messages
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const flashInput = document.getElementById('flash') as HTMLInputElement | null;
      if (flashInput) {
        const flashMessages = JSON.parse(flashInput.value || '{}');
        const dangerMessages = flashMessages.danger || [];
        const hasVerificationError = dangerMessages.some((msg: string) => msg.toLowerCase().includes('not verified'));
        if (hasVerificationError) {
          setShowResendForm(true);
        }
      }
    }
  }, []);

  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text md semibold>
            Login
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <LoginForm formRef={formRef} />
            <Button type="submit" color="primary" block onClick={() => formRef.current?.submit()}>
              Login
            </Button>
          </Flexbox>
        </CardBody>
      </Card>

      {showResendForm && (
        <Card className="my-3">
          <CardHeader>
            <Text md semibold>
              Resend Verification Email
            </Text>
          </CardHeader>
          <CardBody>
            <Text sm className="mb-3">
              Didn't receive the verification email? Enter your email address below to receive a new verification link.
            </Text>
            <ResendVerificationForm formRef={resendFormRef} onCancel={() => setShowResendForm(false)} />
          </CardBody>
        </Card>
      )}

      {!showResendForm && (
        <div className="text-center mt-3">
          <Button color="accent" onClick={() => setShowResendForm(true)}>
            Need to resend verification email?
          </Button>
        </div>
      )}
    </MainLayout>
  );
};

export default RenderToRoot(LoginPage);
