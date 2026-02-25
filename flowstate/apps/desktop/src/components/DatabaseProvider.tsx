import React, { useState, useEffect, type ReactNode } from 'react';
import { initDatabase } from '../db';
import { DatabaseContext, ReadyContext } from './databaseContext';

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

