'use client';
import { useContext } from 'react';
import { CrazyGamesContext, type CrazyGamesMethods } from './CrazyGamesProvider';

export function useCrazyGames(): CrazyGamesMethods {
  return useContext(CrazyGamesContext);
}
