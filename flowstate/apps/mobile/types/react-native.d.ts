import { FlatList as RNFlatList } from 'react-native';

declare module 'react-native' {
  export const FlatList: typeof RNFlatList;
}