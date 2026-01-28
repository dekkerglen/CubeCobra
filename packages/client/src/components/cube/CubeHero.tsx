import React, { useContext } from 'react';

import { GearIcon, HeartIcon, LinkIcon, PackageIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { getCubeCardCountSnippet } from '@utils/Util';

import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import UserContext from '../../contexts/UserContext';

interface CubeHeroProps {
  cube: Cube;
}

const CubeHero: React.FC<CubeHeroProps> = ({ cube }) => {
  const user = useContext(UserContext);
  const isCubeOwner = !!user && cube.owner.id === user.id;

  return (
    <div className="relative w-full overflow-hidden bg-card-green">
      {/* Background image on the right with gradient */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${cube.image.uri})`,
          backgroundSize: '50% auto',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          maskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0) 50%)',
          WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0) 50%)',
        }}
      />

      {/* Content */}
      <div className="relative px-4 py-8">
        <div className="max-w-2xl">
          {/* Title and gear icon */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-black font-semibold text-4xl">
                {cube.name}
              </h1>
              <Text md className="text-black/80 mt-1">
                {getCubeCardCountSnippet(cube)} Cube
              </Text>
            </div>
            {isCubeOwner && (
              <button
                className="text-black hover:text-gray-700 transition-colors flex-shrink-0"
                aria-label="Cube settings"
              >
                <GearIcon size={24} />
              </button>
            )}
          </div>
          
          {/* Action icons */}
          <Flexbox direction="row" gap="4" className="mb-4">
            <button
              className="flex items-center gap-2 text-black hover:text-gray-700 transition-colors"
              aria-label="Follow cube"
            >
              <HeartIcon size={20} />
              <Text sm className="text-black">Follow</Text>
            </button>
            <button
              className="flex items-center gap-2 text-black hover:text-gray-700 transition-colors"
              aria-label="Share cube"
            >
              <LinkIcon size={20} />
              <Text sm className="text-black">Share</Text>
            </button>
            <button
              className="flex items-center gap-2 text-black hover:text-gray-700 transition-colors"
              aria-label="Purchase cube"
            >
              <PackageIcon size={20} />
              <Text sm className="text-black">Purchase</Text>
            </button>
          </Flexbox>

          {/* Description */}
          <Text md className="text-black">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default CubeHero;
