import React from 'react';

import Input from 'components/base/Input';
import TextEntry from 'components/TextEntry';
import Record from 'datatypes/Record';

import { Flexbox } from '../components/base/Layout';

interface EditDescriptionProps {
  value: Partial<Record>;
  setValue: (value: Partial<Record>) => void;
}

const EditDescription: React.FC<EditDescriptionProps> = ({ value, setValue }) => {
  return (
    <Flexbox direction="col" gap="2">
      <Input
        label="Record Name"
        type="text"
        value={value.name}
        onChange={(e) => setValue({ ...value, name: e.target.value })}
        placeholder="Enter a name for the record"
        className="w-full"
      />
      <Input
        label="Date"
        type="date"
        value={value.date ? new Date(value.date).toISOString().split('T')[0] : ''}
        onChange={(e) => setValue({ ...value, date: e.target.value ? new Date(e.target.value).valueOf() : undefined })}
        placeholder="Select a date for the record"
        className="w-full"
      />
      <label className="block text-sm font-medium text-text">{`Description (optional)`}</label>
      <TextEntry value={value.description || ''} setValue={(e) => setValue({ ...value, description: e })} />
    </Flexbox>
  );
};

export default EditDescription;
