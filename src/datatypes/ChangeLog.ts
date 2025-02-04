import { Changes } from './Card';

export interface CubeChangeLog {
  cubeId: string;
  date: number;
  changelog: Changes;
}

export default interface ChangeLog {
  cube: string;
  date: number;
  id: string;
}
