"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

const SEGMENT_LABELS: Record<string, string> = {
  "": "nav.dashboard",
  library: "nav.library",
  chat: "nav.chat",
  "api-portal": "nav.apiPortal",
  activity: "nav.activity",
  settings: "nav.settings",
  uploads: "nav.uploads",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  isLast: boolean;
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [
    {
      label: t("nav.dashboard"),
      href: "/",
      isLast: segments.length === 0,
    },
  ];

  segments.forEach((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const labelKey = SEGMENT_LABELS[segment];
    const label = labelKey ? t(labelKey) : segment;
    items.push({
      label,
      href,
      isLast: index === segments.length - 1,
    });
  });

  return items;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const items = buildBreadcrumbs(pathname);

  if (items.length <= 1 && pathname === "/") {
    return null;
  }

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1 text-sm text-muted-foreground"
    >
      {items.map((item, index) => (
        <span key={item.href} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3 w-3" />}
          {item.isLast ? (
            <span className={cn("font-medium text-foreground")}>{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
