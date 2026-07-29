/**
 * components/icons.tsx
 *
 * Íconos SVG lineales compartidos — reemplazan emojis en superficies
 * cliente-facing (Portal del Cliente) donde se busca un look formal.
 */

interface IconProps {
  className?: string;
}

export function CarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 11l1.3-4A2 2 0 0 1 8.2 5.6h7.6a2 2 0 0 1 1.9 1.4L19 11m-14 0h14m-14 0a1.6 1.6 0 0 0-1.6 1.6V15a1 1 0 0 0 1 1h1m13-5a1.6 1.6 0 0 1 1.6 1.6V15a1 1 0 0 1-1 1h-1M5.6 16v1.1a1 1 0 0 0 1 1H8a1 1 0 0 0 1-1V16m6 0v1.1a1 1 0 0 0 1 1h1.4a1 1 0 0 0 1-1V16M8 13h.01M16 13h.01"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
