"use client";

import { useState, useEffect } from "react";
import { Smartphone, Monitor, Apple, CheckCircle2, X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstalarAppModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"ios" | "android" | "pc">("ios");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar sistema operativo para preseleccionar la pestaña adecuada
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setTab("ios");
    } else if (/android/.test(userAgent)) {
      setTab("android");
    } else {
      setTab("pc");
    }

    // Verificar si ya está ejecutándose como PWA instalada
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Escuchar el evento nativo de instalación en Chrome/Android
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function handleNativeInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="card w-full max-w-lg shadow-2xl relative border-orange-200 dark:border-stone-800 bg-card p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-muted hover:text-foreground rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Instalar JFSP como Aplicación
            </h3>
            <p className="text-xs text-muted">
              Úsala a pantalla completa, sin barras de navegador y con acceso directo.
            </p>
          </div>
        </div>

        {isInstalled && (
          <div className="my-4 p-3 rounded-xl bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 text-xs border border-green-200 dark:border-green-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>¡Ya estás usando JFSP en modo aplicación!</span>
          </div>
        )}

        {/* Selector de plataforma */}
        <div className="flex rounded-xl bg-muted/20 p-1 my-4 text-xs font-semibold">
          <button
            onClick={() => setTab("ios")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "ios"
                ? "bg-card text-foreground shadow-sm font-bold text-orange-600 dark:text-orange-400"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Apple className="w-4 h-4" />
            <span>iPhone / iPad</span>
          </button>
          <button
            onClick={() => setTab("android")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "android"
                ? "bg-card text-foreground shadow-sm font-bold text-orange-600 dark:text-orange-400"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android</span>
          </button>
          <button
            onClick={() => setTab("pc")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "pc"
                ? "bg-card text-foreground shadow-sm font-bold text-orange-600 dark:text-orange-400"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Mac / Windows</span>
          </button>
        </div>

        {/* Contenido según la pestaña */}
        <div className="space-y-3.5 my-4">
          {tab === "ios" && (
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-foreground">Abre en Safari y toca Compartir</p>
                  <p className="text-xs text-muted mt-0.5">
                    En la barra inferior de Safari, pulsa el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-foreground">Selecciona &quot;Agregar a pantalla de inicio&quot;</p>
                  <p className="text-xs text-muted mt-0.5">
                    Desliza hacia abajo en las opciones del menú y toca <strong>Agregar a pantalla de inicio</strong> (icono con signo +).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-foreground">Toca &quot;Agregar&quot; arriba a la derecha</p>
                  <p className="text-xs text-muted mt-0.5">
                    ¡Listo! Aparecerá el icono de <strong>JFSP</strong> en tu pantalla de inicio y se abrirá a pantalla completa como una app real.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "android" && (
            <div className="space-y-3 text-sm">
              {deferredPrompt && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl mb-3 text-center">
                  <p className="text-xs text-orange-800 dark:text-orange-200 mb-2 font-medium">
                    Tu navegador permite instalarla en 1 clic:
                  </p>
                  <button
                    onClick={handleNativeInstall}
                    className="btn-primary w-full py-2.5 text-xs font-bold"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Instalar JFSP ahora
                  </button>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-foreground">Toca los tres puntos (⋮) en Chrome</p>
                  <p className="text-xs text-muted mt-0.5">
                    Están ubicados en la esquina superior derecha del navegador.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-foreground">Elige &quot;Instalar aplicación&quot;</p>
                  <p className="text-xs text-muted mt-0.5">
                    (O en algunos teléfonos &quot;Agregar a la pantalla principal&quot;).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-foreground">Pulsa &quot;Instalar&quot;</p>
                  <p className="text-xs text-muted mt-0.5">
                    El icono de <strong>JFSP</strong> se agregará a tu cajón de aplicaciones.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "pc" && (
            <div className="space-y-3 text-sm">
              {deferredPrompt && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl mb-3 text-center">
                  <p className="text-xs text-orange-800 dark:text-orange-200 mb-2 font-medium">
                    Instalación directa disponible en tu navegador:
                  </p>
                  <button
                    onClick={handleNativeInstall}
                    className="btn-primary w-full py-2.5 text-xs font-bold"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Instalar aplicación en esta computadora
                  </button>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-foreground">En Chrome, Edge o Brave</p>
                  <p className="text-xs text-muted mt-0.5">
                    En la barra de direcciones (donde escribes la URL), haz clic en el icono de <strong>Instalar</strong> (pantalla con flecha) o en los 3 puntos (⋮) &rarr; <em>&quot;Instalar JFSP...&quot;</em>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-foreground">En Mac con Safari (macOS Sonoma+)</p>
                  <p className="text-xs text-muted mt-0.5">
                    Ve al menú superior de tu Mac: <strong>Archivo</strong> &rarr; <strong>&quot;Agregar al Dock...&quot;</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-foreground">Ventana independiente</p>
                  <p className="text-xs text-muted mt-0.5">
                    Se abrirá como un programa de escritorio independiente sin barras del navegador.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie con botón de cierre */}
        <div className="flex justify-end pt-3 border-t border-border mt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary text-xs py-2 px-5"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
