// Loads a TF.js model bundle from a local directory (as downloaded from model/<version>/ or a run's
// bundle/) and runs batched inference with it.
import * as tf from '@tensorflow/tfjs-node';
import { INDEX_TO_ORACLE_FILE } from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';

export interface LoadedModel {
  version: string;
  dir: string;
  numCards: number;
  indexToOracle: string[];
  oracleToIndex: Map<string, number>;
  encoder: tf.GraphModel;
  cubeDecoder: tf.GraphModel;
  deckDecoder: tf.GraphModel;
  draftDecoder: tf.GraphModel;
}

const BATCH_SIZE = 256;

const loadGraph = (dir: string, name: string) => tf.loadGraphModel(`file://${path.join(dir, name, 'model.json')}`);

export const loadModel = async (dir: string, version: string): Promise<LoadedModel> => {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, INDEX_TO_ORACLE_FILE), 'utf8')) as Record<string, string>;
  const numCards = Object.keys(raw).length;
  const indexToOracle = Array.from({ length: numCards }, (_, i) => raw[String(i)] ?? '');
  const [encoder, cubeDecoder, deckDecoder, draftDecoder] = await Promise.all([
    loadGraph(dir, 'encoder'),
    loadGraph(dir, 'cube_decoder'),
    loadGraph(dir, 'deck_build_decoder'),
    loadGraph(dir, 'draft_decoder'),
  ]);
  return {
    version,
    dir,
    numCards,
    indexToOracle,
    oracleToIndex: new Map(indexToOracle.map((oracle, index) => [oracle, index])),
    encoder,
    cubeDecoder,
    deckDecoder,
    draftDecoder,
  };
};

const multiHot = (rows: number[][], numCards: number): tf.Tensor2D => {
  const data = new Float32Array(rows.length * numCards);
  rows.forEach((row, i) => {
    for (const card of row) data[i * numCards + card] = 1;
  });
  return tf.tensor2d(data, [rows.length, numCards]);
};

const splitRows = (tensor: tf.Tensor2D): Float32Array[] => {
  const [count, width] = tensor.shape;
  const data = tensor.dataSync() as Float32Array;
  return Array.from({ length: count }, (_, i) => data.slice(i * width, (i + 1) * width));
};

/** The encoder's embedding for each multi-hot input row. */
export const encodeRows = (model: LoadedModel, rows: number[][]): Float32Array[] => {
  const out: Float32Array[] = [];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    out.push(
      ...tf.tidy(() => splitRows(model.encoder.predict(multiHot(batch, model.numCards)) as tf.Tensor2D)),
    );
  }
  return out;
};

/** decoder(encoder(row)) for each multi-hot input row: one score per card in the vocabulary. */
export const decodeRows = (model: LoadedModel, decoder: tf.GraphModel, rows: number[][]): Float32Array[] => {
  const out: Float32Array[] = [];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    out.push(
      ...tf.tidy(() => {
        const embedding = model.encoder.predict(multiHot(batch, model.numCards)) as tf.Tensor2D;
        return splitRows(decoder.predict(embedding) as tf.Tensor2D);
      }),
    );
  }
  return out;
};

/**
 * Maps card indices from one vocabulary to another through oracle ids. Null when any card is
 * missing from the target vocabulary.
 */
export const remapCards = (cards: number[], from: LoadedModel, to: LoadedModel): number[] | null => {
  const out: number[] = [];
  for (const card of cards) {
    const index = to.oracleToIndex.get(from.indexToOracle[card] ?? '');
    if (index === undefined) return null;
    out.push(index);
  }
  return out;
};
