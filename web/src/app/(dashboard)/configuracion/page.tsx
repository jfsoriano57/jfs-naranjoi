"use client";

import { useState, useEffect } from "react";
import { Key, ShieldCheck, Sparkles, ExternalLink, Check, AlertCircle } from "lucide-react";

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setHasKey(data.has_gemini_key);
          setDisplayName(data.display_name || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          apiKey: apiKey ? apiKey : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      if (apiKey) {
        setHasKey(true);
        setApiKey("");
      }
      setMessage({ type: "success", text: "Configuración guardada correctamente." });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al guardar",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey() {
    if (!confirm("¿Deseas eliminar tu clave personal de Gemini?")) return;
    setSaving(true);
    try {
      await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "" }),
      });
      setHasKey(false);
      setMessage({ type: "success", text: "Clave eliminada. Se usará el límite estándar." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
          Configuración & Clave de IA
        </h1>
        <p className="text-muted text-sm mt-1">
          Personaliza tu perfil y conecta tu propia clave de Google Gemini para estudiar sin límites y a coste $0.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-2.5 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-5 h-5 flex-shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tarjeta de Clave Gemini */}
      <div className="card space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Tu Clave Personal de Gemini</h2>
              <p className="text-xs text-muted">Google AI Studio (100% gratuita, sin tarjeta)</p>
            </div>
          </div>

          {hasKey ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              Clave Activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Sin clave propia (cuota básica)
            </span>
          )}
        </div>

        {/* Guía rápida para el alumno */}
        <div className="rounded-xl bg-accent p-4 text-xs text-muted space-y-2">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            ¿Por qué poner tu propia clave?
          </p>
          <p>
            Google regala a cada usuario miles de preguntas gratis al día. Con tu propia clave, tienes respuestas más rápidas, libros completos y no dependes del límite compartido.
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline pt-1"
          >
            <span>Obtener mi clave gratis en Google AI Studio (1 minuto)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">
              {hasKey ? "Reemplazar clave de API de Gemini" : "Pegar clave de API de Gemini"}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••••••••••••••••••••••••••" : "AIzaSy..."}
              className="input font-mono text-sm"
            />
            <p className="text-xs text-muted mt-1">
              Tu clave se almacena cifrada en el servidor con algoritmo AES-256 de grado bancario.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            {hasKey ? (
              <button
                type="button"
                onClick={handleRemoveKey}
                disabled={saving}
                className="btn-danger text-xs"
              >
                Eliminar clave
              </button>
            ) : <span />}

            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      {/* Perfil básico */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold text-foreground">Información personal</h2>
        <div>
          <label className="label">Nombre para mostrar</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre"
            className="input"
          />
        </div>
      </div>
    </div>
  );
}
