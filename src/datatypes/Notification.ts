export interface Notification {
  id: string;
  date: number;
  to: string;
  from: string;
  url?: string;
  body: string;
  status: 'r' | 'u';
  fromUsername?: string;
  toStatusComp?: string;
}
