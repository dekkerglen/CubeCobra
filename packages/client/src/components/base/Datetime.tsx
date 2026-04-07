import React from 'react';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absoluteFormatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });

function formatRelative(diffMs: number): string {
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    if (Math.abs(diffHours) < 1) {
      const diffMinutes = Math.round(diffMs / (60 * 1000));
      return relativeFormatter.format(diffMinutes, 'minute');
    }
    return relativeFormatter.format(diffHours, 'hour');
  }
  return relativeFormatter.format(diffDays, 'day');
}

interface DatetimeProps {
  date: Date | number | string;
}

const Datetime: React.FC<DatetimeProps> = ({ date }) => {
  const d = new Date(date);
  const diffMs = d.getTime() - Date.now();
  const isRecent = Math.abs(diffMs) < SEVEN_DAYS_MS;

  const display = isRecent ? formatRelative(diffMs) : absoluteFormatter.format(d);
  const isoString = d.toISOString();

  return <time dateTime={isoString}>{display}</time>;
};

export default Datetime;
