import { createContext, use, useCallback, useRef, useState } from 'react';

interface SessionReadContextType {
  sessionReadIds: Set<string>;
  addSessionRead: (id: string) => void;
  setViewKey: (key: string) => void;
}

const SessionReadContext = createContext<SessionReadContextType | undefined>(undefined);

export function SessionReadProvider({ children }: { children: React.ReactNode }) {
  const viewKeyRef = useRef<string>('');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const setViewKey = useCallback((key: string) => {
    if (key !== viewKeyRef.current) {
      viewKeyRef.current = key;
      setReadIds(new Set<string>());
    }
  }, []);

  const addSessionRead = useCallback((id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
  }, []);

  return (
    <SessionReadContext.Provider value={{ sessionReadIds: readIds, addSessionRead, setViewKey }}>
      {children}
    </SessionReadContext.Provider>
  );
}

export function useSessionRead(): SessionReadContextType {
  const context = use(SessionReadContext);
  if (!context) {
    throw new Error('useSessionRead must be used within SessionReadProvider');
  }
  return context;
}
