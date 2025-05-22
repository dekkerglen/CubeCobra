import React from 'react';

const FormatttedDate: React.FC<{ date: number }> = ({ date }) => {
  const dateObj = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formattedDate = dateObj.toLocaleDateString('en-US', options);

  return <span>{formattedDate}</span>;
};

export default FormatttedDate;
