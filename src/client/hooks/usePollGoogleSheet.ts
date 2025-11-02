import React from 'react';
import { parseRotoCSV } from '../../util/rotodraft';
import RotoDraftContext from 'contexts/RotoDraftContext';

const usePollGoogleSheet = () => {
  const { url, setRotoInfo } = React.useContext(RotoDraftContext);

  React.useEffect(() => {
    const fetchUrl = async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          console.error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
          return;
        }
        const text = await resp.text();

        const { picks, players, picksByPlayer } = parseRotoCSV(text);
        console.log('fetched and setting rotoinfo', picks);
        setRotoInfo({ picks, players, picksByPlayer });
      } catch (error) {
        console.error('Error fetching Google Sheet:', error);
      }
    };

    if (url === '') {
      console.log('blank URL, exiting');
      return;
    }

    // Fetch immediately
    fetchUrl();

    // Set up polling every 60 seconds
    const intervalId = setInterval(() => {
      fetchUrl();
    }, 60000);

    // Cleanup function to clear the interval when URL changes or component unmounts
    return () => {
      clearInterval(intervalId);
    };
  }, [url, setRotoInfo]);
};

export default usePollGoogleSheet;
