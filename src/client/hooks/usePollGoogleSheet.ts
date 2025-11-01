import React from "react";
import { parseRotoCSV } from "../../util/rotodraft";
import RotoDraftContext from "contexts/RotoDraftContext";

const usePollGoogleSheet = () => {
  const { url, setRotoInfo } = React.useContext(RotoDraftContext);

  React.useEffect(() => {
    const fetchUrl = async () => {
      const resp = await fetch(url);
      const text = await resp.text();

      const { picks, players, picksByPlayer } = parseRotoCSV(text);
      console.log('fetched and setting rotoinfo');
      setRotoInfo({ picks, players, picksByPlayer });
    }

    if (url === "") {
      console.log('blank URL, exiting')
      return;
    }

    // Fetch immediately
    fetchUrl();

    // Set up polling every 60 seconds
    const intervalId = setInterval(() => {
      fetchUrl();
    }, 6000);

    // Cleanup function to clear the interval when URL changes or component unmounts
    return () => {
      clearInterval(intervalId);
    };
  }, [url, setRotoInfo]);
}

export default usePollGoogleSheet;