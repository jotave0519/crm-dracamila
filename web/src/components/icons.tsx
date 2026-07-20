import { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement> & { d: string }) {
  const { d, ...rest } = props;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={d} />
    </svg>
  );
}

export const HomeIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z" />;
export const CalendarIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />;
export const UsersIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.9M15 2.1a4 4 0 0 1 0 7.8" />;
export const MessageIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M21 11a8 8 0 1 1-3.5-6.6L21 3l-1 4a7.96 7.96 0 0 1 1 4Z" />;
export const MoreIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M5 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM11 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM17 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" />;
export const SearchIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35" />;
export const BellIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />;
export const LogOutIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;
export const PlusIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M12 5v14M5 12h14" />;
export const XIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M18 6 6 18M6 6l12 12" />;
export const ArrowLeftIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M19 12H5M12 19l-7-7 7-7" />;
export const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M5 12h14M12 5l7 7-7 7" />;
export const SunIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />;
export const MoonIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />;
export const TrashIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3m3 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7h14Z" />;
export const PencilIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />;
