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
      setRotoInfo({ picks, players, picksByPlayer });
    }

    if (url === "") {
      console.log('blank URL, exiting')
      return;
    }
    
    fetchUrl();
  }, [url, setRotoInfo]);
}

export default usePollGoogleSheet;