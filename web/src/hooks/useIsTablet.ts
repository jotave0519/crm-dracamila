import { useEffect, useState } from "react";

const QUERY = "(min-width: 769px) and (max-width: 1024px)";

export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsTablet(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTablet;
}
