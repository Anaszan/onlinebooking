import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.25" />
  </Svg>
);
export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 4.9 4.9l1.3-2 4 1.6V17a3 3 0 0 1-3 3A15 15 0 0 1 2 7a3 3 0 0 1 3-3Z" />
  </Svg>
);
export const IconMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);
export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11.5c0 4-3.6 7-8 7a9 9 0 0 1-3-.5L4 19.5l1.2-3.6A6.6 6.6 0 0 1 4 11.5c0-4 3.6-7 8-7s8 3 8 7Z" />
  </Svg>
);
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);
export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.1V4.5a1 1 0 0 1 1-1h7.6l8.4 8.4-8.6 8.6-8.4-8.4Z" />
    <circle cx="8.5" cy="8.5" r="1.5" />
  </Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.9.7 3.2 2.5 3.5 5.2" />
  </Svg>
);
export const IconStore = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5V20h16V9.5M3 9.5 5 4h14l2 5.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);
export const IconContact = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <circle cx="12" cy="10" r="2.75" />
    <path d="M7.5 17c.8-1.9 2.5-3 4.5-3s3.7 1.1 4.5 3" />
  </Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);
export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.8-7 9-4.1-1.2-7-4.7-7-9V6l7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
  </Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l16 16M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.4 7.6C3.9 9.3 2.5 12 2.5 12S6 18 12 18a9 9 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
export const IconLogin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M4 12h11M11 8l4 4-4 4" />
  </Svg>
);
export const IconUserPlus = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="8" r="3.75" />
    <path d="M3 20c.7-3.700 3.500-6 7-6 1.500 0 2.900.4 4 1.200M18 14v6M15 17h6" />
  </Svg>
);

/** Paw print, filled — the house ornament. */
export function IconPaw({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d="M12 12.2c-2.700 0-5.600 2.700-5.600 5.200 0 1.800 1.300 2.600 2.800 2.600 1.200 0 1.800-.6 2.800-.6s1.600.6 2.800.6c1.500 0 2.800-.8 2.800-2.600 0-2.500-2.900-5.200-5.600-5.200Z" />
      <ellipse cx="5" cy="10.2" rx="2.200" ry="2.700" transform="rotate(-18 5 10.200)" />
      <ellipse cx="9.200" cy="5.600" rx="2.200" ry="2.800" transform="rotate(-6 9.200 5.600)" />
      <ellipse cx="14.800" cy="5.600" rx="2.200" ry="2.800" transform="rotate(6 14.800 5.600)" />
      <ellipse cx="19" cy="10.200" rx="2.200" ry="2.700" transform="rotate(18 19 10.200)" />
    </svg>
  );
}

/** SYSRENT mark: the round orange cat's face. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M5 13 6.500 3.500 13 8.200h6L25.500 3.500 27 13c1.300 2 2 4 2 6 0 6.600-5.800 10.500-13 10.500S3 25.600 3 19c0-2 .7-4 2-6Z" fill="#f08a3c" />
      <path d="M13.500 8.400h5l-.8 3.200h-3.400Z" fill="#d9600f" opacity=".55" />
      <ellipse cx="11" cy="18" rx="1.600" ry="2" fill="#3d2314" />
      <ellipse cx="21" cy="18" rx="1.600" ry="2" fill="#3d2314" />
      <path d="M14.600 21.600h2.800L16 23Z" fill="#f2788a" />
      <path d="M13.400 24c1.300 1 2.600 1 2.600-.9 0 1.900 1.300 1.900 2.600.9" fill="none" stroke="#3d2314" strokeWidth="1.100" strokeLinecap="round" />
    </svg>
  );
}
