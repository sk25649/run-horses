'use client';

import React from 'react';

interface GhostButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
  small?: boolean;
}

export default function GhostButton({
  children,
  onClick,
  color = '#00ffcc',
  small = false,
}: GhostButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1.5px solid ${color}`,
        color,
        padding: small ? '8px 22px' : '14px 44px',
        fontSize: small ? 11 : 13,
        fontWeight: 700,
        letterSpacing: small ? 2 : 4,
        cursor: 'pointer',
        borderRadius: 4,
        fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = `${color}18`)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
      }
    >
      {children}
    </button>
  );
}
