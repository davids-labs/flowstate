import { useContext } from 'react';
import { DatabaseContext, ReadyContext } from './databaseContext';

export function useDatabase(): unknown {
  return useContext(DatabaseContext);
}

export function useDatabaseReady(): boolean {
  return useContext(ReadyContext);
}
