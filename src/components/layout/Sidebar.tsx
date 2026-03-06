"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  Plug,
  History,
  Settings,
  Upload,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useSidebarStore, useThemeStore } from "@/store";

// Rehydrate persisted stores once on client mount (avoids SSR hydration mismatch).
// skipHydration: true is set on both stores, so this is the only place rehydration happens.
if (typeof window !== "undefined") {
  useSidebarStore.persist.rehydrate();
  useThemeStore.persist.rehydrate();
}

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/library", icon: FolderOpen, labelKey: "nav.library" },
  { href: "/uploads", icon: Upload, labelKey: "nav.uploads" },
  { href: "/chat", icon: MessageSquare, labelKey: "nav.chat" },
  { href: "/api-portal", icon: Plug, labelKey: "nav.apiPortal" },
  { href: "/activity", icon: History, labelKey: "nav.activity" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapsed } = useSidebarStore();
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        isCollapsed ? "w-14" : "w-56"
      )}
    >
      {/* App name */}
      <div className="flex h-14 items-center border-b border-border px-3">
        {!isCollapsed && (
          <span className="text-sm font-semibold tracking-tight">
            {t("common.appName")}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? t(labelKey) : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>{t(labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-1 border-t border-border p-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isCollapsed && "justify-center"
          )}
          title={isDark ? t("common.lightMode") : t("common.darkMode")}
          aria-label={isDark ? t("common.lightMode") : t("common.darkMode")}
        >
          {isDark ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!isCollapsed && (
            <span>{isDark ? t("common.lightMode") : t("common.darkMode")}</span>
          )}
        </button>

        {/* Collapse button */}
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? t("common.expand") : t("common.collapse")}
          aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          {!isCollapsed && <span>{t("common.collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}
