"use client";

import { useState } from "react";
import { UploadCloud, X, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { DocumentKind } from "@/types";

import { createClient } from "@/lib/supabase/client";

const TIPOS_MATERIAL: { value: DocumentKind; label: string; desc: string }[] = [
  { value: "texto_basico", label: "Texto Básico / Libro", desc: "Manual, libro guía o bibliografía de la materia" },
  { value: "programa", label: "Programa de la Materia", desc: "Sílabo, contenido temático y fechas de examen" },
  { value: "apuntes", label: "Apuntes o Diapositivas", desc: "Notas de clase, resúmenes o presentaciones" },
  { value: "ejercicios", label: "Ejercicios / Prácticas", desc: "Guías de problemas, exámenes anteriores o talleres" },
  { value: "otro", label: "Otro Material", desc: "Cualquier otro documento complementario" },
];

export function SubirMaterialModal({
  subjectId,
  onUploaded,
}: {
  subjectId: string;
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>("texto_basico");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title) {
        // Quitar la extensión para el título por defecto
        const baseName = selected.name.replace(/\.[^/.]+$/, "");
        setTitle(baseName);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Sesión no iniciada. Por favor recarga e inicia sesión.");
      }

      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setStepStatus(`Subiendo archivo a tu bóveda privada (${sizeMb} MB)...`);

      // Subir directamente a Supabase Storage (evita el límite de 4.5 MB de Vercel)
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${subjectId}/${Date.now()}_${cleanFileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("materiales")
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(`Error al subir a tu almacenamiento: ${uploadErr.message}`);
      }

      setStepStatus("Extrayendo texto y preparando temas de estudio...");
      const res = await fetch(`/api/materias/${subjectId}/materiales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          title: title.trim() || file.name,
          kind,
          sizeBytes: file.size,
          mimeType: file.type || "application/pdf",
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMessage = "Error al procesar el archivo";
        try {
          const parsed = JSON.parse(text);
          errMessage = parsed.error || errMessage;
        } catch {
          errMessage = text || `Error del servidor (${res.status})`;
        }
        throw new Error(errMessage);
      }

      setOpen(false);
      setFile(null);
      setTitle("");
      onUploaded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setLoading(false);
      setStepStatus(null);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <UploadCloud className="w-4 h-4" />
        <span>Subir Material</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="card w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => !loading && setOpen(false)}
              disabled={loading}
              className="absolute top-4 right-4 p-1.5 text-muted hover:text-foreground rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 text-foreground">
              Subir Material de Estudio
            </h3>
            <p className="text-sm text-muted mb-5">
              Sube PDFs, libros, programas o fotos de apuntes para que tu tutor IA aprenda de ellos.
            </p>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selector de archivo */}
              <div>
                <label className="label">Archivo (PDF, Word, TXT o Imagen)</label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition">
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.txt,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
                    {file ? (
                      <div>
                        <p className="text-sm font-semibold text-foreground">{file.name}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • Haz clic para cambiar
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Selecciona un archivo desde tu equipo
                        </p>
                        <p className="text-xs text-muted mt-1">
                          Admite libros en PDF, programas y fotos de apuntes
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="label">Título o descripción del material</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Stewart - Cálculo Trascendentes Tempranas"
                  className="input"
                />
              </div>

              {/* Tipo de material */}
              <div>
                <label className="label">Tipo de material</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {TIPOS_MATERIAL.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setKind(t.value)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition flex flex-col justify-between ${
                        kind === t.value
                          ? "border-primary bg-primary/5 text-foreground font-semibold"
                          : "border-border text-muted hover:border-border/80"
                      }`}
                    >
                      <span className="text-foreground font-medium">{t.label}</span>
                      <span className="text-[10px] text-muted line-clamp-1 mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {loading && stepStatus && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl text-xs text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span>{stepStatus}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="btn-primary"
                >
                  {loading ? "Procesando..." : "Subir y Procesar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
