import { useEffect, useState } from "react";

const HANDSET_QUERY = "(max-width: 1023px)";

export function useIsHandset() {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(HANDSET_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(HANDSET_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return matches;
}

