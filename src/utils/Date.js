const monthNames = [
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

const addOrdinal = (num) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

const formatDateTime = (date) => {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  const hour = date.getHours();
  const minute = date.getMinutes();

  const ampm = hour >= 12 ? 'pm' : 'am';

  return `${monthNames[month]} ${addOrdinal(day)}, ${year} - ${hour % 12}:${
    minute < 10 ? `0${minute}` : minute
  } ${ampm}`;
};

const formatDate = (date) => {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  return `${monthNames[month]} ${addOrdinal(day)}, ${year}`;
};

module.exports = {
  formatDate,
  formatDateTime,
};
