import React from 'react';

interface Image {
  artist: string;
  uri: string;
}

interface MtgImageProps {
  image: Image;
  showArtist?: boolean;
}

const MtgImage: React.FC<MtgImageProps> = ({ image, showArtist = false }) => {
  return (
    <div className="relative">
      <img className="w-100" alt={`Art by ${image.artist}`} src={image.uri} />
      {showArtist && (
        <em className="text-sm absolute bottom-0 right-2 text-white text-shadow">Art by {image.artist}</em>
      )}
    </div>
  );
};

export default MtgImage;
