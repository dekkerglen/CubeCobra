import { BaseObject } from './BaseObject';
import { Changes } from './Card';

export interface CubeChangeLog {
  id: string;
  cubeId: string;
  date: number;
  changelog: Changes;
}

export default interface ChangeLog extends BaseObject {
  cube: string;
  date: number;
  id: string;
  // The cube version this changelog produced. Lets history be mapped 1:1 to a
  // cube version so gaps (a version with no changelog) can be detected. Optional
  // for backwards compatibility with rows written before this field existed.
  cubeVersion?: number;
}
