import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { initDatabase } from '../db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DatabaseContext = createContext<any>(null);
const ReadyContext = createContext<boolean>(false);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [db, setDb] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then((database) => {
        setDb(database);
        setReady(true);
      })
      .catch((err) => {
        console.error('Failed to initialize database:', err);
      });
  }, []);

  return (
    <DatabaseContext.Provider value={db}>
      <ReadyContext.Provider value={ready}>
        {children}
      </ReadyContext.Provider>
    </DatabaseContext.Provider>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDatabase(): any {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used within DatabaseProvider');
  return db;
}

export function useDatabaseReady(): boolean {
  return useContext(ReadyContext);
}
