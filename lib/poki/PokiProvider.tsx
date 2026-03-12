'use client';
import { createContext, useRef, useState, type ReactNode } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    PokiSDK: {
      init: () => Promise<void>;
      gameLoadingFinished: () => void;
      gameplayStart: () => void;
      gameplayStop: () => void;
      commercialBreak: (onStart?: () => void) => Promise<void>;
      rewardedBreak: (opts: { size?: 'small' | 'medium' | 'large'; onStart?: () => void }) => Promise<boolean>;
    };
  }
}

export interface PokiMethods {
  isEnabled: boolean;
  gameLoadingFinished: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  commercialBreak: (onStart?: () => void) => Promise<void>;
  rewardedBreak: (opts?: { size?: 'small' | 'medium' | 'large'; onStart?: () => void }) => Promise<boolean>;
}

export const DISABLED_POKI: PokiMethods = {
  isEnabled: false,
  gameLoadingFinished: () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  commercialBreak: async () => {},
  rewardedBreak: async () => false,
};

export const PokiContext = createContext<PokiMethods>(DISABLED_POKI);

export function isPokiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_POKI === '1';
}

export function buildPokiMethods(isGameplayActiveRef: React.MutableRefObject<boolean>): PokiMethods {
  return {
    isEnabled: true,
    gameLoadingFinished: () => {
      window.PokiSDK?.gameLoadingFinished();
    },
    gameplayStart: () => {
      if (isGameplayActiveRef.current) return;
      if (!window.PokiSDK) return;
      isGameplayActiveRef.current = true;
      window.PokiSDK.gameplayStart();
    },
    gameplayStop: () => {
      if (!isGameplayActiveRef.current) return;
      if (!window.PokiSDK) return;
      isGameplayActiveRef.current = false;
      window.PokiSDK.gameplayStop();
    },
    commercialBreak: async (onStart?: () => void) => {
      if (!window.PokiSDK) return;
      await window.PokiSDK.commercialBreak(onStart);
    },
    rewardedBreak: async (opts = {}) => {
      if (!window.PokiSDK) return false;
      return window.PokiSDK.rewardedBreak(opts);
    },
  };
}

export function PokiProvider({ children }: { children: ReactNode }) {
  const [methods, setMethods] = useState<PokiMethods>(DISABLED_POKI);
  const isGameplayActiveRef = useRef(false);

  if (!isPokiEnabled()) {
    return <PokiContext.Provider value={DISABLED_POKI}>{children}</PokiContext.Provider>;
  }

  function handleScriptLoad() {
    if (!window.PokiSDK) return;

    window.PokiSDK.init()
      .then(() => {
        window.PokiSDK.gameLoadingFinished();
      })
      .catch(() => {
        // init failed — SDK may still be partially functional
      });

    setMethods(buildPokiMethods(isGameplayActiveRef));
  }

  return (
    <>
      <Script
        src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <PokiContext.Provider value={methods}>{children}</PokiContext.Provider>
    </>
  );
}
