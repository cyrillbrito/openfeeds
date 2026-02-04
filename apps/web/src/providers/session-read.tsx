import { createContext, createSignal, useContext, type ParentComponent } from 'solid-js';

interface SessionReadContextType {
  sessionReadIds: () => Set<string>;
  addSessionRead: (id: string) => void;
  setViewKey: (key: string) => void;
}

const SessionReadContext = createContext<SessionReadContextType>();

export const SessionReadProvider: ParentComponent = (props) => {
  const [viewKey, setViewKeySignal] = createSignal<string>('');
  const [readIds, setReadIds] = createSignal<Set<string>>(new Set());

  const setViewKey = (key: string) => {
    if (key !== viewKey()) {
      setViewKeySignal(key);
      setReadIds(new Set<string>());
    }
  };

  const addSessionRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
  };

  const value: SessionReadContextType = {
    sessionReadIds: readIds,
    addSessionRead,
    setViewKey,
  };

  return <SessionReadContext.Provider value={value}>{props.children}</SessionReadContext.Provider>;
};

export function useSessionRead(): SessionReadContextType {
  const context = useContext(SessionReadContext);
  if (!context) {
    throw new Error('useSessionRead must be used within SessionReadProvider');
  }
  return context;
}
