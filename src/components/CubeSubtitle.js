import React, { useContext, useMemo } from 'react';

import CubeContext from 'contexts/CubeContext';
import { getCubeDescription } from 'utils/Util';

const CubeSubtitle = () => {
  const { cube, unfilteredChangedCards } = useContext(CubeContext);

  const subtitle = useMemo(() => getCubeDescription(cube, unfilteredChangedCards), [cube, unfilteredChangedCards]);
  return (
    <div className="nav-item px-lg-4 px-3 text-sm-start text-center font-weight-boldish mt-auto mb-2">
      {cube.name}
      <span className="d-sm-inline"> ({subtitle})</span>
    </div>
  );
};

export default CubeSubtitle;
