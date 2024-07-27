export default interface Cube {
  id: string;
  name: string;
  formats: {
    title: string;
  }[];
  defaultDraftFormat?: number;
}