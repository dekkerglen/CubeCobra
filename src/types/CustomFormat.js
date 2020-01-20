/**
 * Class for defining the attributes of a custom draft format.
 *
 * @param {string} id
 * @param {string} title Title of the custom draft format
 * @param {boolean} multiples Whether to allow multiples of an instance of a card to appear in the custom draft.
 * @param {string} html The html description of the custom draft format.
 * @param {string[][]} packTemplates A pack template contains a comma-separated list of tags to filter which cards it can contain.
 *
 * @throws TypeError
 */
export default class CustomFormat {
  constructor(id, title, multiples, html, packTemplates) {
    if (typeof id !== 'string') {
      throw new TypeError('CustomFormat id must be of type string, ' + typeof id + ' given.');
    }
    if (typeof title !== 'string') {
      throw new TypeError('CustomFormat title must be of type string, ' + typeof title + ' given.');
    }
    if (typeof multiples !== 'boolean') {
      throw new TypeError('CustomFormat multiples must be of type boolean, ' + typeof multiples + ' given.');
    }
    if (typeof html !== 'string') {
      throw new TypeError('CustomFormat html must be of type string, ' + typeof multiples + ' given.');
    }
    if (!Array.isArray(packTemplates)) {
      throw new TypeError('CustomFormat packTemplates must be of type array, ' + typeof cardSlots + ' given.');
    }
    packTemplates.forEach((cardSlot) => {
      cardSlot.forEach((contents) => {
        if (typeof contents !== 'string') {
          throw new TypeError(
            'CustomFormat packTemplates must be of type string[][], ' + typeof cardSlot + '[][] given.',
          );
        }
      });
    });

    this.id = id;
    this.title = title;
    this.multiples = multiples;
    this.html = html;
    this.packTemplates = packTemplates;
  }
}
