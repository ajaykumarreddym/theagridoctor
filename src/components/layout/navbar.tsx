"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User as UserIcon, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarNav } from "./sidebar-nav";
import { createClient } from "@/lib/supabase/client";
import { NotificationsBell } from "./notifications-bell";
import Link from "next/link";

export function Navbar({
  profile,
}: {
  profile: { name: string; email: string; initials: string };
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between md:justify-end">
        <div className="flex items-center md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </Button>
          <span className="ml-2 text-lg font-bold text-slate-800">AgriDoctor</span>
        </div>

        <div className="flex items-center space-x-3">
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8 bg-emerald-100">
                  <AvatarFallback className="text-emerald-800 font-bold bg-transparent text-xs uppercase">
                    {profile.initials || <UserIcon className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none truncate">{profile.name}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{profile.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/profile">
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Profile &amp; Settings</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                disabled={signingOut}
                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              >
                {signingOut ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-64 shadow-xl">
            <SidebarNav profile={profile} mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
