import React, { useContext, useMemo, useState } from 'react';

import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import CSRFForm from '../CSRFForm';
import ConfirmActionModal from '../modals/ConfirmActionModal';
import withModal from '../WithModal';

const ConfirmDeleteButton = withModal(Button, ConfirmActionModal);

const UserAccountDeletion: React.FC = () => {
  const user = useContext(UserContext);
  const [password, setPassword] = useState('');
  const formRef = React.useRef<HTMLFormElement>(null);

  const hasCubes = (user?.cubes || []).length > 0;
  const canDelete = !hasCubes && password.length >= 8;

  const formData = useMemo(
    () => ({
      password,
    }),
    [password],
  );

  return (
    <Flexbox direction="col" gap="2">
      <Text semibold lg className="text-danger">
        Delete Account
      </Text>
      <Text>
        Deleting your account is permanent and cannot be undone. All of your cubes, blog posts, drafts, and comments
        will be deleted.
      </Text>

      {hasCubes && (
        <Flexbox direction="col" gap="2" className="p-3 bg-warning/10 border border-warning rounded">
          <Text semibold className="text-warning">
            Account Deletion Disabled
          </Text>
          <Text>
            You must delete all of your cubes before you can delete your account. You currently have{' '}
            {user?.cubes?.length || 0} cube{(user?.cubes?.length || 0) !== 1 ? 's' : ''}.
          </Text>
          <Button type="link" color="primary" href="/user/view" block>
            View Your Cubes
          </Button>
        </Flexbox>
      )}

      <CSRFForm method="POST" action="/user/deleteaccount" ref={formRef} formData={formData}>
        <Flexbox direction="col" gap="2">
          <Input
            label="Current password"
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={hasCubes}
            placeholder="Enter your current password to confirm"
          />
          <ConfirmDeleteButton
            block
            color="danger"
            disabled={!canDelete}
            modalprops={{
              title: 'Confirm Account Deletion',
              message:
                'Are you absolutely sure you want to delete your account? This action cannot be undone. All of your cubes, blog posts, drafts, and comments will be permanently deleted.',
              buttonText: 'Delete My Account',
              onClick: () => formRef.current?.submit(),
            }}
          >
            Delete My Account
          </ConfirmDeleteButton>
        </Flexbox>
      </CSRFForm>
    </Flexbox>
  );
};

export default UserAccountDeletion;
