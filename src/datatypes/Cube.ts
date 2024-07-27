import User from './User';

export interface CubeImage {
  uri: string;
  artist: string;
  id: string;
  imageName: string;
}

export interface TagColor {
  color: string | null;
  tag: string;
}

interface Cube {
  id: string;
  shortId: string;
  owner: User;
  name: string;
  visibility: string;
  priceVisibility: string;
  featured: boolean;
  categoryOverride: string;
  categoryPrefixes: any[];
  tagColors: TagColor[];
  defaultFormat: number;
  numDecks: number;
  description: string;
  imageName: string;
  date: number;
  defaultSorts: string[];
  showUnsorted?: boolean;
  formats: { title: string }[];
  following: string[];
  defaultStatus: string;
  defaultPrinting: string;
  disableAlerts: boolean;
  basics: string[];
  tags: any[];
  keywords: string[];
  cardCount: number;
  image: CubeImage;
}

export default Cube;
