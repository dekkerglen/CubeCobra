import React, { useContext, useMemo } from 'react';

import { Flexbox } from 'components/base/Layout';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Text from 'components/base/Text';
import CubeContext from 'contexts/CubeContext';
import { getCubeDescription } from 'utils/Util';

const CubeSubtitle: React.FC = () => {
  const { cube, unfilteredChangedCards } = useContext(CubeContext);

  const subtitle = useMemo(() => getCubeDescription(cube, unfilteredChangedCards), [cube, unfilteredChangedCards]);

  return (
    <Flexbox direction="row" gap="2" alignItems="end" className="py-2">
      <Text semibold md>
        {cube.name}
      </Text>
      <ResponsiveDiv md>
        <Text md>({subtitle})</Text>
      </ResponsiveDiv>
    </Flexbox>
  );
};

export default CubeSubtitle;
