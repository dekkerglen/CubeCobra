declare module 'JSONStream' {
  import { Readable, Writable } from 'stream';

  function parse(path: string | string[]): Writable;
  function stringify(open?: string, sep?: string, close?: string): Readable;
  function stringifyObject(open?: string, sep?: string, close?: string): Readable;

  export { parse, stringify, stringifyObject };
}
