import { arraysEqual } from 'utils/Util';

class DraftLocation {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }

  static pack(data) {
    return new DraftLocation(DraftLocation.PACK, data);
  }

  static picks(data) {
    return new DraftLocation(DraftLocation.PICKS, data);
  }

  static deck(data) {
    return new DraftLocation(DraftLocation.DECK, data);
  }

  static sideboard(data) {
    return new DraftLocation(DraftLocation.SIDEBOARD, data);
  }

  equals(other) {
    if (this.type !== other.type) {
      return false;
    }

    if (Array.isArray(this.data) && Array.isArray(other.data)) {
      return arraysEqual(this.data, other.data);
    }

    return this.data === other.data;
  }

  toString() {
    return `DraftLocation.${this.type}(${this.data})`;
  }
}
DraftLocation.PACK = 'pack';
DraftLocation.PICKS = 'picks';
DraftLocation.DECK = 'deck';
DraftLocation.SIDEBOARD = 'sideboard';

export default DraftLocation;
