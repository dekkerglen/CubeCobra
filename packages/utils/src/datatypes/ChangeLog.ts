import { BaseObject } from './BaseObject';
import { Changes } from './Card';

export interface CubeChangeLog {
  cubeId: string;
  date: number;
  changelog: Changes;
}

export default interface ChangeLog extends BaseObject {
  cube: string;
  date: number;
  id: string;
}
