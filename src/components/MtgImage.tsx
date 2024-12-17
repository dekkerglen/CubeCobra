import React from 'react';

interface Image {
  artist: string;
  uri: string;
}

interface MtgImageProps {
  image: Image;
  showArtist?: boolean;
  className?: string;
}

const MtgImage: React.FC<MtgImageProps> = ({ image, showArtist = false, className }) => {
  return (
    <div className={`relative ${className}`}>
      <img className="w-full" alt={`Art by ${image.artist}`} src={image.uri} />
      {showArtist && (
        <em className="text-sm absolute bottom-0 right-2 text-white text-shadow">Art by {image.artist}</em>
      )}
    </div>
  );
};

export default MtgImage;
