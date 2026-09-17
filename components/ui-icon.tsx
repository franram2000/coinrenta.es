import type { SVGProps } from "react";

export type UiIconName =
  | "dashboard"
  | "connections"
  | "movements"
  | "renta"
  | "reports"
  | "help"
  | "settings"
  | "profile"
  | "users"
  | "shield"
  | "credit-card"
  | "lock"
  | "bell"
  | "monitor"
  | "globe"
  | "trash"
  | "check"
  | "arrow-right";

const paths: Record<UiIconName, JSX.Element> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  connections: <><path d="M8 7h8"/><path d="M13 4l3 3-3 3"/><path d="M16 17H8"/><path d="M11 14l-3 3 3 3"/></>,
  movements: <><path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h14"/><circle cx="8" cy="7" r="1" fill="currentColor"/><circle cx="16" cy="12" r="1" fill="currentColor"/><circle cx="10" cy="17" r="1" fill="currentColor"/></>,
  renta: <><path d="M12 3v18"/><path d="M17 7.5c-.8-1.1-2.2-1.8-4.1-1.8-2.5 0-4 1.1-4 2.9 0 4.6 8.2 1.7 8.2 6.2 0 1.8-1.6 3.1-4.3 3.1-2 0-3.6-.7-4.6-2"/></>,
  reports: <><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 4.2 1.6c-.9 1-2 1.2-2 2.8"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/></>,
  settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 4.4 12 2 2 0 0 0 3 8.6a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 9.3 4.5v-.2a2 2 0 0 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1A2 2 0 1 1 19.6 8.6a2 2 0 0 0-.2 3.4 2 2 0 0 0 0 3Z"/></>,
  profile: <><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.9-3.1 3.1-4.8 6.5-4.8s5.6 1.7 6.5 4.8"/></>,
  users: <><circle cx="9" cy="9" r="3"/><path d="M3.5 20c.7-2.8 2.6-4.2 5.5-4.2s4.8 1.4 5.5 4.2"/><path d="M15.5 6.2a2.8 2.8 0 0 1 0 5.6"/><path d="M16.2 15.9c2.4.5 3.8 1.8 4.3 4.1"/></>,
  shield: <><path d="M12 3 19 6v5.2c0 4.6-2.8 8.1-7 9.8-4.2-1.7-7-5.2-7-9.8V6z"/><path d="m9 12 2 2 4-4"/></>,
  "credit-card": <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 6 2 7H4c0-1 2-1 2-7"/><path d="M10 20h4"/></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.3 2.4 3.4 5.4 3.4 9s-1.1 6.6-3.4 9c-2.3-2.4-3.4-5.4-3.4-9S9.7 5.4 12 3Z"/></>,
  trash: <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m7 7 1 14h8l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.3 2.3 4.8-5"/></>,
  "arrow-right": <><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></>,
};

export default function UiIcon({ name, size = 18, strokeWidth = 1.8, ...props }: SVGProps<SVGSVGElement> & { name: UiIconName; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {paths[name]}
    </svg>
  );
}
