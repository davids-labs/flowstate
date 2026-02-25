import { createContext } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DatabaseContext = createContext<any>(null);
export const ReadyContext = createContext<boolean>(false);
