export default function Logo({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#12102a" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" stroke="#7FF0C8" strokeOpacity="0.45" />
      <path d="M11 27V13h3.2l6.2 9.4V13H24v14h-3.2L14.6 17.7V27H11Z" fill="#7FF0C8" />
      <path d="M26.5 27V18.2h3.1V27h-3.1Z" fill="#9b6dff" />
      <circle cx="28.05" cy="15.2" r="1.55" fill="#5ce6ff" />
    </svg>
  );
}
