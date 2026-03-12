'use client';
import { useContext } from 'react';
import { PokiContext, type PokiMethods } from './PokiProvider';

export function usePoki(): PokiMethods {
  return useContext(PokiContext);
}
