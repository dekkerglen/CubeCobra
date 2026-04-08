//Split this into its own file to prevent cyclic dependencies

import * as cardutil from '@utils/cardutil';
import Image from '@utils/datatypes/Image';

import carddb, { cardFromId, getIdsFromName } from './carddb';

// uri
// artist
// id

const FALLBACK_IMAGE: Image = {
  uri: '',
  artist: 'Unknown',
  id: 'default',
  imageName: 'default',
};

// Curated list of scryfall IDs for random new cube art
const NEW_CUBE_ART_SCRYFALL_IDS = [
  '00d594df-c51b-4936-9af1-536dab1792ae',
  '14749600-9eca-4122-b04f-30ddda091b74',
  '3d946df5-f206-4241-bb55-97db67dc793c',
  '1c472e70-300c-4881-86e7-c5ca690ab9b6',
  '0b79ec57-7c45-4ef9-9051-449d473b65ea',
  'fa3ed190-2dbf-48fd-8adc-16e9ec7f5f21',
  '31b0f9ef-7404-4e05-b759-aaf1ebcfcb31',
  'cdaa22df-e071-4b2a-aa42-0334ff7bd662',
  'c477fb1a-5aac-4722-80d8-7570a8b09e44',
];

/**
 * Returns a random image from the curated new-cube art list.
 * Falls back to the default 'doubling cube' image if the card is not found.
 */
export function getRandomNewCubeImage(): { imageName: string; image: Image } {
  const randomId = NEW_CUBE_ART_SCRYFALL_IDS[Math.floor(Math.random() * NEW_CUBE_ART_SCRYFALL_IDS.length)];

  // Try cardimages dict first (keyed by scryfall ID)
  const fromImages = carddb.cardimages[randomId!];
  if (fromImages) {
    return { imageName: fromImages.imageName, image: fromImages };
  }

  // Try carddict (card details keyed by scryfall ID)
  const details = cardFromId(randomId!);
  if (details?.scryfall_id && details.art_crop && details.artist) {
    const image: Image = {
      uri: details.art_crop,
      artist: details.artist,
      id: details.scryfall_id,
      imageName: details.full_name || details.name || randomId!,
    };
    return { imageName: image.imageName, image };
  }

  // Fallback to default
  const defaultImageName = 'doubling cube [10e-321]';
  return { imageName: defaultImageName, image: getImageData(defaultImageName) };
}

export function getImageData(imagename: string | undefined): Image {
  const defaultImage = carddb.imagedict['doubling cube [10e-321]'] ?? FALLBACK_IMAGE;

  if (!imagename) {
    return defaultImage;
  }

  const exact = carddb.imagedict[imagename.toLowerCase()];

  if (exact) {
    return exact;
  }

  const name = cardutil.normalizeName(imagename);
  const ids = getIdsFromName(name);

  if (ids !== undefined && ids.length > 0 && ids[0]) {
    const byName = cardFromId(ids[0]);
    if (byName?.scryfall_id && byName.art_crop && byName.artist) {
      return {
        uri: byName.art_crop,
        artist: byName.artist,
        id: byName.scryfall_id,
        imageName: imagename,
      };
    }
  }

  return defaultImage;
}
