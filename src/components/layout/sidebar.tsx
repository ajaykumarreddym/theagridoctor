import { SidebarNav } from "./sidebar-nav";

export function Sidebar({
  profile,
}: {
  profile: { name: string; email: string; initials: string };
}) {
  return <SidebarNav profile={profile} />;
}
