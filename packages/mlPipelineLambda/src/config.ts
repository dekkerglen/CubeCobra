import type { PromotionTarget } from '@utils/datatypes/RetrainTask';

// One environment a model can be promoted to (packages/cdk/config.ts MlPromoteTarget).
export interface PromoteTarget {
  dataBucket: string;
  recommenderEnvironmentName: string;
  ssmSegment: string;
}

export type PromoteTargets = Record<PromotionTarget, PromoteTarget>;

export const PROMOTION_TARGETS: readonly PromotionTarget[] = ['beta', 'production'];

export const isPromotionTarget = (value: unknown): value is PromotionTarget =>
  typeof value === 'string' && (PROMOTION_TARGETS as readonly string[]).includes(value);

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
};

// Bucket holding the training runs (ml/runs/<runId>/); the production data bucket.
export const runsBucket = (): string => required('ML_RUNS_BUCKET');

export const parsePromoteTargets = (raw: string): PromoteTargets => {
  const parsed = JSON.parse(raw) as Partial<PromoteTargets> | null;
  for (const target of PROMOTION_TARGETS) {
    const entry = parsed?.[target];
    if (!entry?.dataBucket || !entry.recommenderEnvironmentName) {
      throw new Error(`ML_PROMOTE_TARGETS has no complete ${target} target`);
    }
  }
  return parsed as PromoteTargets;
};

export const promoteTarget = (target: PromotionTarget): PromoteTarget =>
  parsePromoteTargets(required('ML_PROMOTE_TARGETS'))[target];
