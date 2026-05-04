interface LogoProps {
  variant?: 'full' | 'mark' | 'wordmark';
  className?: string;
  /** Render text in white (for dark backgrounds). Default: navy. */
  inverted?: boolean;
}

const NAVY = '#202971';
const ORANGE = '#FF8001';

/**
 * Brand mark: a navy filled square overlapped by an orange outline square.
 * Mirrors the PikeSquare logo's visual grammar (navy + orange square motif).
 */
function Mark({ inverted = false }: { inverted?: boolean }) {
  const navyFill = inverted ? '#FFFFFF' : NAVY;
  return (
    <>
      <rect x="6" y="14" width="28" height="28" fill={navyFill} />
      <rect x="22" y="14" width="28" height="28" fill="none" stroke={ORANGE} strokeWidth="3.5" />
    </>
  );
}

export default function Logo({ variant = 'full', className = '', inverted = false }: LogoProps) {
  const textColor = inverted ? '#FFFFFF' : NAVY;

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 56 56"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="FormationIQ"
        role="img"
      >
        <Mark inverted={inverted} />
      </svg>
    );
  }

  if (variant === 'wordmark') {
    return (
      <svg
        viewBox="0 0 320 56"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="FormationIQ"
        role="img"
      >
        <text
          x="0"
          y="42"
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontSize="44"
          fontWeight="700"
          fill={textColor}
          letterSpacing="-1"
        >
          FormationIQ
        </text>
      </svg>
    );
  }

  // 'full' — mark + wordmark, side by side
  return (
    <svg
      viewBox="0 0 360 56"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FormationIQ"
      role="img"
    >
      <Mark inverted={inverted} />
      <text
        x="68"
        y="42"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="36"
        fontWeight="700"
        fill={textColor}
        letterSpacing="-0.8"
      >
        FormationIQ
      </text>
    </svg>
  );
}
