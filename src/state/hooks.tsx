import { useContext } from 'react';
import { AppStateContext, AppDispatchContext } from './AppProvider';
import type { AppState, AppAction } from '../types';
import type { Dispatch } from 'react';


export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const ctx = useContext(AppDispatchContext);
  if (!ctx) throw new Error('useAppDispatch must be used within AppProvider');
  return ctx;
}
