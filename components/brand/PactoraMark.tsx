type PactoraMarkProps = {
  className?: string;
  title?: string;
};

export function PactoraMark({ className, title }: PactoraMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M18 11H38C47.9 11 54 16.2 54 23.8C54 32.4 47.8 38.4 35 44C27.6 40.6 21.9 35.8 18 30"
        stroke="currentColor"
        strokeWidth="9.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 11V54"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M29 24.5H42"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="29" cy="24.5" r="2.75" fill="currentColor" />
      <circle cx="35.5" cy="24.5" r="2.75" fill="currentColor" />
      <circle cx="42" cy="24.5" r="2.75" fill="currentColor" />
    </svg>
  );
}
