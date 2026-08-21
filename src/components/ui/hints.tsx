import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pat-hints";

const HintsContext = createContext<{ on: boolean; toggle: () => void }>({
  on: false,
  toggle: () => {},
});

/**
 * Every panel used to carry its own "?" affordance — twenty-odd of them on the
 * dashboard alone, which reads as noise rather than help. They are now off by
 * default and revealed together from the header.
 */
export function HintsProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);

  // localStorage only exists on the client; reading it during render would
  // desync hydration.
  useEffect(() => {
    try {
      setOn(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode / storage disabled — stay off */
    }
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <HintsContext.Provider value={{ on, toggle }}>
      {children}
    </HintsContext.Provider>
  );
}

export function useHints() {
  return useContext(HintsContext);
}
