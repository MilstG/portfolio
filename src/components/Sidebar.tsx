"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: PieChart },
  { href: "/cash", label: "Cuentas de Cash", icon: Wallet },
  { href: "/cashflow", label: "Cashflow", icon: ArrowLeftRight },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-zinc-800 bg-[#0a0c12]">
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">
          Patrimonio
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="rounded-lg bg-zinc-900/80 px-3 py-3">
          <p className="text-xs font-medium text-zinc-300">Net Worth</p>
          <p className="mt-0.5 text-lg font-semibold text-white">$124,850</p>
          <p className="mt-0.5 text-xs text-emerald-400">+2.4% este mes</p>
        </div>
      </div>
    </aside>
  );
}
