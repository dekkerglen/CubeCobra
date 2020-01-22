import { useMemo } from "react"

let lastID = 1000;

const useNewID = () => {
  return useMemo(() => `id-${lastID++}`, []);
}

export default useNewID;