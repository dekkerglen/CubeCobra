import React from 'react';

import Record from '@utils/datatypes/Record';

import Input from 'components/base/Input';
import Text from 'components/base/Text';
import TextEntry from 'components/TextEntry';

import { Flexbox } from '../components/base/Layout';

export interface EditDescriptionErrors {
  name?: string;
  date?: string;
  description?: string;
}

interface EditDescriptionProps {
  value: Partial<Record>;
  setValue: (value: Partial<Record>) => void;
  /**
   * Per-field validation messages, shown under the field they belong to and marking it
   * invalid. Optional: most callers submit through a form post and learn about a rejection
   * from the server, and only the transcription workspace validates as you type.
   */
  errors?: EditDescriptionErrors;
}

// A field's message, under the field itself so it needs no words identifying which input it
// is about. `role="alert"` so a screen reader hears it when it appears rather than only on
// a later visit to the field.
const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    // role on a wrapper: Text does not forward arbitrary DOM attributes.
    <div role="alert">
      <Text sm className="text-danger">
        {message}
      </Text>
    </div>
  ) : null;

const EditDescription: React.FC<EditDescriptionProps> = ({ value, setValue, errors }) => {
  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="col" gap="1">
        <Input
          label="Record Name"
          type="text"
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
          placeholder="Enter a name for the record"
          className="w-full"
          valid={errors?.name ? false : undefined}
        />
        <FieldError message={errors?.name} />
      </Flexbox>
      <Flexbox direction="col" gap="1">
        <Input
          label="Date"
          type="date"
          value={value.date ? new Date(value.date).toISOString().split('T')[0] : ''}
          onChange={(e) =>
            setValue({ ...value, date: e.target.value ? new Date(e.target.value).valueOf() : undefined })
          }
          placeholder="Select a date for the record"
          className="w-full"
          valid={errors?.date ? false : undefined}
        />
        <FieldError message={errors?.date} />
      </Flexbox>
      <label className="block text-sm font-medium text-text">{`Description (optional)`}</label>
      <TextEntry value={value.description || ''} setValue={(e) => setValue({ ...value, description: e })} />
      <FieldError message={errors?.description} />
    </Flexbox>
  );
};

export default EditDescription;
