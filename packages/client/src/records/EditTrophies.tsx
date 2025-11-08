import React from 'react';

import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import Record from '@utils/datatypes/Record';

interface EditTrophiesProps {
  record: Record;
  trophies: string[];
  setTrophies: (trophies: string[]) => void;
}

const EditTrophies: React.FC<EditTrophiesProps> = ({ record, trophies, setTrophies }) => {
  return (
    <Flexbox direction="col" gap="2">
      {record.players.map((player, index) => (
        <Flexbox key={index} direction="row" gap="3" alignItems="center">
          <Checkbox
            label="Trophy"
            checked={trophies.includes(player.name)}
            setChecked={(checked) => {
              const newTrophies = checked
                ? [...trophies, player.name]
                : trophies.filter((trophy) => trophy !== player.name);
              setTrophies(newTrophies);
            }}
          />
          <Text sm>{player.name}</Text>
        </Flexbox>
      ))}
    </Flexbox>
  );
};

export default EditTrophies;
