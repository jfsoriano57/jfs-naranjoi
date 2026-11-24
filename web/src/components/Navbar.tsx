"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  BookOpen, 
  MessageSquare, 
  Key, 
  Sparkles, 
  LogOut, 
  Layers
} from "lucide-react";

export function Navbar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navItems = [
    { href: "/materias", label: "Mis Materias", icon: Layers },
    { href: "/tutor", label: "Tutor IA", icon: MessageSquare },
    { href: "/configuracion", label: "Mi Clave IA", icon: Key },
  ];

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logotipo */}
        <Link href="/materias" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-foreground">
            NARANJO
          </span>
        </Link>

        {/* Enlaces de navegación */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold"
                    : "text-muted hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Usuario y cerrar sesión */}
        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-xs text-muted hidden md:inline truncate max-w-[150px]">
              {userEmail}
            </span>
          )}
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="p-2 rounded-xl text-muted hover:text-danger hover:bg-danger/10 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
