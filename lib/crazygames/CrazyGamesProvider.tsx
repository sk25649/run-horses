'use client';
import { createContext, useRef, useState, type ReactNode } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    CrazyGames: {
      SDK: {
        init: () => Promise<void>;
        getEnvironment: () => 'crazygames' | 'local' | string;
        ad: {
          requestAd: (
            type: 'midgame' | 'rewarded',
            callbacks: {
              adStarted?: () => void;
              adError?: (error: unknown) => void;
              adFinished?: () => void;
            },
          ) => void;
        };
        game: {
          gameplayStart: () => void;
          gameplayStop: () => void;
          happytime: () => void;
        };
      };
    };
  }
}

export interface CrazyGamesMethods {
  isEnabled: boolean;
  gameplayStart: () => void;
  gameplayStop: () => void;
  midgameAd: (onStart?: () => void) => Promise<void>;
  happytime: () => void;
}

export const DISABLED_CRAZYGAMES: CrazyGamesMethods = {
  isEnabled: false,
  gameplayStart: () => {},
  gameplayStop: () => {},
  midgameAd: async () => {},
  happytime: () => {},
};

export const CrazyGamesContext = createContext<CrazyGamesMethods>(DISABLED_CRAZYGAMES);

export function isCrazyGamesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CRAZYGAMES === '1';
}

export function buildCrazyGamesMethods(
  isGameplayActiveRef: React.MutableRefObject<boolean>,
): CrazyGamesMethods {
  return {
    isEnabled: true,
    gameplayStart: () => {
      if (isGameplayActiveRef.current) return;
      if (!window.CrazyGames?.SDK) return;
      isGameplayActiveRef.current = true;
      window.CrazyGames.SDK.game.gameplayStart();
    },
    gameplayStop: () => {
      if (!isGameplayActiveRef.current) return;
      if (!window.CrazyGames?.SDK) return;
      isGameplayActiveRef.current = false;
      window.CrazyGames.SDK.game.gameplayStop();
    },
    midgameAd: (onStart?: () => void) =>
      new Promise<void>((resolve) => {
        if (!window.CrazyGames?.SDK) { resolve(); return; }
        window.CrazyGames.SDK.ad.requestAd('midgame', {
          adStarted: () => { onStart?.(); },
          adError: () => { resolve(); },
          adFinished: () => { resolve(); },
        });
      }),
    happytime: () => {
      if (!window.CrazyGames?.SDK) return;
      window.CrazyGames.SDK.game.happytime();
    },
  };
}

export function CrazyGamesProvider({ children }: { children: ReactNode }) {
  const [methods, setMethods] = useState<CrazyGamesMethods>(DISABLED_CRAZYGAMES);
  const isGameplayActiveRef = useRef(false);

  if (!isCrazyGamesEnabled()) {
    return (
      <CrazyGamesContext.Provider value={DISABLED_CRAZYGAMES}>
        {children}
      </CrazyGamesContext.Provider>
    );
  }

  function handleScriptLoad() {
    if (!window.CrazyGames?.SDK) return;

    window.CrazyGames.SDK.init()
      .then(() => {
        // SDK initialized — methods are now active
      })
      .catch(() => {
        // init failed — SDK may still be partially functional
      });

    setMethods(buildCrazyGamesMethods(isGameplayActiveRef));
  }

  return (
    <>
      <Script
        src="https://sdk.crazygames.com/crazygames-sdk-v3.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <CrazyGamesContext.Provider value={methods}>{children}</CrazyGamesContext.Provider>
    </>
  );
}
