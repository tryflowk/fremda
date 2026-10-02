import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const stroke = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export const Close = ({ size, ...p }: P) => (
  <svg {...stroke(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export const Speaker = ({ size = 18, ...p }: P) => (
  <svg {...stroke(size)} {...p}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);

export const Languages = ({ size = 18, ...p }: P) => (
  <svg {...stroke(size)} {...p}><path d="M4 5h8M8 3v2M6 5c0 4 2.5 7 6 8M10 5c-.5 3.5-3 7-6 8" /><path d="M13 21l4-10 4 10M14.5 17.5h5" /></svg>
);

export const Bookmark = ({ size = 18, filled, ...p }: P & { filled?: boolean }) => (
  <svg {...stroke(size)} fill={filled ? 'currentColor' : 'none'} {...p}><path d="M6 3h12v18l-6-4-6 4z" /></svg>
);

export const ArrowLeft = ({ size, ...p }: P) => (
  <svg {...stroke(size)} {...p}><path d="M15 5l-7 7 7 7" /></svg>
);

export const Check = ({ size, ...p }: P) => (
  <svg {...stroke(size)} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export const Cards = ({ size = 20, ...p }: P) => (
  <svg {...stroke(size)} {...p}><rect x="3" y="6" width="13" height="15" rx="2.5" /><path d="M8 3h10.5A2.5 2.5 0 0 1 21 5.5V16" /></svg>
);

export const Flame = ({ size = 20, lit = true }: { size?: number; lit?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z"
      fill={lit ? '#E07A3F' : 'none'}
      stroke={lit ? '#A8461F' : '#C9BBA6'}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const OpenBook = ({ size = 88 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 88 88" fill="none" aria-hidden="true">
    <circle cx="44" cy="44" r="40" fill="#EDE2D0" />
    <path d="M26 30c7-3 13-2 18 2v30c-5-4-11-5-18-2z" fill="#FBF7EF" stroke="#221F1B" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M62 30c-7-3-13-2-18 2v30c5-4 11-5 18-2z" fill="#FBF7EF" stroke="#221F1B" strokeWidth="2.5" strokeLinejoin="round" />
    <circle cx="66" cy="24" r="9" fill="#A8461F" />
    <path d="M62 24l3 3 5-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Gear = ({ size = 20, ...p }: P) => (
  <svg {...stroke(size)} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const Cloud = ({ size = 20, ...p }: P) => (
  <svg {...stroke(size)} {...p}><path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" /></svg>
);
