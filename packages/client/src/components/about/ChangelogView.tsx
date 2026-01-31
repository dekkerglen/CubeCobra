import React from 'react';

import { Flexbox } from 'components/base/Layout';
import BlogNavbar from 'components/cube/BlogNavbar';
import CubeHistory from 'components/cube/CubeHistory';

interface ChangelogViewProps {
  changes: Record<string, any>[];
  lastKey?: string;
}

const ChangelogView: React.FC<ChangelogViewProps> = ({ changes, lastKey }) => {
  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <BlogNavbar />
      <CubeHistory changes={changes} lastKey={lastKey} />
    </Flexbox>
  );
};

export default ChangelogView;
