// "Mavi Liman" tasarımındaki çizgi ikonlar (lucide stili, inline SVG).
// Yalnızca görünüm — renk currentColor üzerinden geldiği için bulunduğu
// öğenin metin rengini alır.

const Svg = ({ size = 16, sw = 1.8, children }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {children}
    </svg>
);

export const IconPlus = (p) => (
    <Svg sw={2} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
);

export const IconMinus = (p) => (
    <Svg sw={2} {...p}><path d="M5 12h14" /></Svg>
);

export const IconCheck = (p) => (
    <Svg sw={2.2} {...p}><path d="M20 6 9 17l-5-5" /></Svg>
);

export const IconX = (p) => (
    <Svg sw={1.9} {...p}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></Svg>
);

export const IconTrash = (p) => (
    <Svg {...p}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </Svg>
);

export const IconLogout = (p) => (
    <Svg {...p}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
    </Svg>
);

export const IconLogin = (p) => (
    <Svg sw={2} {...p}>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="m10 17 5-5-5-5" />
        <path d="M15 12H3" />
    </Svg>
);

export const IconUser = (p) => (
    <Svg {...p}><circle cx="12" cy="7" r="4" /><path d="M5.5 21a7 7 0 0 1 13 0" /></Svg>
);

export const IconCard = (p) => (
    <Svg {...p}><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></Svg>
);

export const IconShield = (p) => (
    <Svg {...p}><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z" /></Svg>
);

export const IconBag = (p) => (
    <Svg sw={1.6} {...p}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
    </Svg>
);

export const IconCalendar = (p) => (
    <Svg sw={1.7} {...p}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
    </Svg>
);

export const IconPrinter = (p) => (
    <Svg {...p}>
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect width="12" height="8" x="6" y="14" />
    </Svg>
);

export const IconLink = (p) => (
    <Svg {...p}>
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </Svg>
);

export const IconCloche = (p) => (
    <Svg sw={1.5} {...p}>
        <path d="M3 11h18l-2 9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" />
        <path d="M12 4v7" />
        <path d="M8 6c0-1.5 1.8-2 4-2s4 .5 4 2" />
    </Svg>
);

export const IconMail = (p) => (
    <Svg sw={1.5} {...p}><path d="M4 4h16v12H4z" /><path d="m4 8 8 5 8-5" /></Svg>
);

export const IconBell = (p) => (
    <Svg {...p}>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        <path d="M21 19H3l1.6-2.2A6 6 0 0 0 6 13.2V10a6 6 0 0 1 12 0v3.2a6 6 0 0 0 1.4 3.6Z" />
    </Svg>
);

export const IconChefHat = (p) => (
    <Svg sw={1.6} {...p}>
        <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
        <path d="M6 17h12" />
    </Svg>
);

export const IconFlame = (p) => (
    <Svg sw={1.6} {...p}>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
    </Svg>
);

export const IconTruck = (p) => (
    <Svg {...p}>
        <path d="M14 18V6a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" />
        <path d="M14 9h4l3 3v5a1 1 0 0 1-1 1h-1" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
    </Svg>
);
