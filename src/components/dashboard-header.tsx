"use client";

import { useAuth } from '@/hooks/use-auth';
import { Clock, LogOut, User as UserIcon, Menu } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function DashboardHeader() {
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return names[0].substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#1e3a5f] text-white shadow-md">
      <div className="container flex h-14 sm:h-16 items-center px-4 sm:px-6">
        <Link href="/dashboard" className="mr-4 sm:mr-6 flex items-center space-x-2 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <span className="font-semibold text-sm sm:text-base tracking-tight hidden xs:inline-block sm:inline-block">
            Marcaje Aktiva
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-3">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-white/15 focus-visible:ring-white/30">
                  <Avatar className="h-9 w-9 border-2 border-white/25">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="bg-white/20 text-white text-xs font-semibold">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
