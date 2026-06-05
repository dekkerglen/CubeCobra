declare module 'jsonparse' {
  class Parser {
    value: any;
    key: string | number | undefined;
    stack: { value: any; key: any; mode: any }[];
    onValue: (value: any) => void;
    onError: (err: Error) => void;
    write(chunk: Buffer | string): void;
  }

  export default Parser;
}
