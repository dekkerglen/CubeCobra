const monthNames: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const addOrdinal = (num: number): string => {
  const s: string[] = ['th', 'st', 'nd', 'rd'];
  const v: number = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

const formatDateTime = (date: Date): string => {
  const month: number = date.getMonth();
  const day: number = date.getDate();
  const year: number = date.getFullYear();

  const hour: number = date.getHours();
  const minute: number = date.getMinutes();

  const ampm: string = hour >= 12 ? 'pm' : 'am';

  return `${monthNames[month]} ${addOrdinal(day)}, ${year} - ${hour % 12}:${
    minute < 10 ? `0${minute}` : minute
  } ${ampm}`;
};

const formatDate = (date: Date): string => {
  const month: number = date.getMonth();
  const day: number = date.getDate();
  const year: number = date.getFullYear();

  return `${monthNames[month]} ${addOrdinal(day)}, ${year}`;
};

export { formatDate, formatDateTime };
