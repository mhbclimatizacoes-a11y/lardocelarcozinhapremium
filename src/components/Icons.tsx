import type { SVGProps } from "react";

const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
type P = SVGProps<SVGSVGElement>;

export const SearchIcon = (p: P) => (<svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>);
export const BagIcon = (p: P) => (<svg {...base} {...p}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6.5a3 3 0 016 0V8" /></svg>);
export const MenuIcon = (p: P) => (<svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h10" /></svg>);
export const CloseIcon = (p: P) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const PlusIcon = (p: P) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const MinusIcon = (p: P) => (<svg {...base} {...p}><path d="M5 12h14" /></svg>);
export const TrashIcon = (p: P) => (<svg {...base} {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>);
export const CheckIcon = (p: P) => (<svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const TruckIcon = (p: P) => (<svg {...base} {...p}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" /><circle cx="7.5" cy="17" r="1.8" /><circle cx="17" cy="17" r="1.8" /></svg>);
export const ShieldIcon = (p: P) => (<svg {...base} {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>);
export const LeafIcon = (p: P) => (<svg {...base} {...p}><path d="M5 19c0-9 5-14 14-14 0 9-5 14-14 14z" /><path d="M5 19l8-8" /></svg>);
export const GridIcon = (p: P) => (<svg {...base} {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>);
export const ArrowIcon = (p: P) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const FilterIcon = (p: P) => (<svg {...base} {...p}><path d="M4 7h16M7 12h10M10 17h4" /></svg>);

export const BoxIcon = (p: P) => (<svg {...base} {...p}><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" /><path d="M4 8l8 4 8-4M12 12v8" /></svg>);
export const RefreshIcon = (p: P) => (<svg {...base} {...p}><path d="M19 8a7.5 7.5 0 00-13-1.5L4 9M4 5v4h4M5 16a7.5 7.5 0 0013 1.5L20 15M20 19v-4h-4" /></svg>);
export const ChatIcon = (p: P) => (<svg {...base} {...p}><path d="M5 6h14v9H10l-4 3.5V15H5V6z" /></svg>);
export const ImageIcon = (p: P) => (<svg {...base} {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M5 17l4.5-4.5 3.5 3.5 2-2 4 4" /></svg>);

export const HomeIcon = (p: P) => (<svg {...base} {...p}><path d="M4 11l8-6.5 8 6.5M6 10v9h12v-9" /></svg>);
export const ListIcon = (p: P) => (<svg {...base} {...p}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>);
export const TagIcon = (p: P) => (<svg {...base} {...p}><path d="M4 12.5V5h7.5L20 13.5 13.5 20 4 12.5z" /><circle cx="8.5" cy="9.5" r="1" /></svg>);
export const GearIcon = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></svg>);
export const ExternalIcon = (p: P) => (<svg {...base} {...p}><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" /></svg>);
export const LogoutIcon = (p: P) => (<svg {...base} {...p}><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></svg>);
export const WalletIcon = (p: P) => (<svg {...base} {...p}><path d="M4 7h14a2 2 0 012 2v9H6a2 2 0 01-2-2V7zM4 7l12-2v2" /><circle cx="16" cy="13" r="1" /></svg>);
export const ChevronIcon = (p: P) => (<svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>);

export function Logo({ name, url, className = "" }: { name: string; url?: string; className?: string }) {
  if (url) return <img src={url} alt={name} className={`h-8 w-auto max-w-[180px] object-contain ${className}`} />;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="32" fill="currentColor" opacity=".92" />
        <path d="M20 44c0-14 8-22 24-24-1 16-9 24-24 24zm0 0l14-14" fill="none" stroke="var(--logo-leaf, #f8f5ee)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-semibold uppercase tracking-[0.24em]">{name}</span>
    </span>
  );
}
