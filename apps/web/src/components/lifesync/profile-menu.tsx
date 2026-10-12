"use client";

import {
  ChevronsUpDown,
  CircleHelp,
  LogOut,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Row } from "@/lib/api";
import { useLocale } from "./providers";

export function ProfileMenu({
  user,
  plan,
  onLogout,
  onNavigate,
}: {
  user?: Row;
  plan?: "FREE" | "PRO";
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useLocale();
  const name = String(user?.name || "LifeSync");
  const email = typeof user?.email === "string" ? user.email : "";
  const image = typeof user?.image === "string" ? user.image : undefined;
  const initials =
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toUpperCase() || "LS";
  const planLabel = plan ? t(plan === "PRO" ? "pro" : "free") : t("plan");
  const links = [
    { key: "profile", href: "/profile", icon: UserRound },
    { key: "personalization", href: "/personalization", icon: SlidersHorizontal },
    { key: "settings", href: "/settings", icon: Settings2 },
    { key: "trash", href: "/trash", icon: Trash2 },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={!user}
          aria-label={`${t("accountMenu")}: ${name}`}
          className="h-auto min-h-16 w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left"
        >
          <Avatar size="lg">
            <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{planLabel}</span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={10}
        className="lifesync-profile-menu w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-2 shadow-lg"
      >
        <DropdownMenuLabel className="px-3 py-3">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="mt-1 block truncate text-xs font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="min-h-11 gap-3 rounded-xl px-3">
            <Link href="/pricing" onClick={onNavigate}>
              <Sparkles className="size-4" />
              <span>{t("plan")}</span>
              <span className="ml-auto text-xs text-muted-foreground">{plan ? planLabel : ""}</span>
            </Link>
          </DropdownMenuItem>
          {links.map(({ key, href, icon: Icon }) => (
            <DropdownMenuItem key={key} asChild className="min-h-11 gap-3 rounded-xl px-3">
              <Link href={href} onClick={onNavigate}>
                <Icon className="size-4" />
                {t(key)}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 gap-3 rounded-xl px-3">
          <Link href="/security" onClick={onNavigate}>
            <CircleHelp className="size-4" />
            {t("helpAndSecurity")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout} className="min-h-11 gap-3 rounded-xl px-3">
          <LogOut className="size-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
