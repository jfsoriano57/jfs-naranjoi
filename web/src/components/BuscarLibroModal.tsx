"use client";

import { useState } from "react";
import { Search, Globe, BookOpen, Download, ExternalLink, Loader2, X, PlusCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type BookResult = {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  source: string;
  downloadUrl?: string;
  previewUrl?: string;
  coverUrl?: string;
};

export function BuscarLibroModal({
  subjectId,
  onImported,
}: {
  subjectId: string;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/libros/buscar?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la búsqueda");
      setResults(data.results || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al buscar libros");
    } finally {
      setSearching(false);
    }
  }

  async function handleImportUrl(book: BookResult) {
    if (!book.downloadUrl) return;
    setImportingId(book.id);
    setError(null);

    try {
      // Descargar el archivo a través del cliente y enviarlo a la API de materiales
      const downloadRes = await fetch(book.downloadUrl);
      if (!downloadRes.ok) throw new Error("No se pudo descargar el archivo del repositorio público.");

      const blob = await downloadRes.blob();
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const cleanFileName = book.title.replace(/[^a-zA-Z0-9._-]/g, "_") + ".pdf";
      const storagePath = `${user.id}/${subjectId}/${Date.now()}_${cleanFileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("materiales")
        .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });

      if (uploadErr) throw new Error(uploadErr.message);

      const uploadRes = await fetch(`/api/materias/${subjectId}/materiales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          title: `${book.title} (${book.authors.join(", ")})`,
          kind: "texto_basico",
          sizeBytes: blob.size,
          mimeType: "application/pdf",
        }),
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "");
        throw new Error(text || "Error al procesar el libro");
      }

      setOpen(false);
      onImported();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al importar el libro a tu materia");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary"
      >
        <Globe className="w-4 h-4 text-primary" />
        <span>Buscar en Internet</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-muted hover:text-foreground rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                <span>Buscar Texto o Libro en Internet</span>
              </h3>
              <p className="text-xs text-muted mt-1">
                Encuentra libros de dominio público, textos de estudio y bibliografía en bibliotecas abiertas.
              </p>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Título del libro, autor o tema (ej. Stewart Cálculo, Resnick Física)..."
                className="input flex-1 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="btn-primary px-4 text-xs font-semibold"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </button>
            </form>

            {/* Resultados */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {searching ? (
                <div className="py-12 text-center text-xs text-muted flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Consultando Open Library, Google Books e Internet Archive...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted">
                  Ingresa el nombre de un libro para buscarlo en repositorios abiertos.
                </div>
              ) : (
                results.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-border bg-card/60 hover:bg-accent/40 transition flex items-start gap-3.5 justify-between"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {b.coverUrl ? (
                        <img
                          src={b.coverUrl}
                          alt={b.title}
                          className="w-12 h-16 object-cover rounded-md border border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded-md bg-muted/10 border border-border flex items-center justify-center flex-shrink-0 text-muted">
                          <BookOpen className="w-6 h-6" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-foreground line-clamp-1">{b.title}</h4>
                        <p className="text-xs text-muted truncate mt-0.5">{b.authors.join(", ")}</p>
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted">
                          <span className="font-medium px-2 py-0.5 rounded bg-muted/15 text-foreground">
                            {b.source}
                          </span>
                          {b.year && <span>Año: {b.year}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {b.previewUrl && (
                        <a
                          href={b.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost p-2 text-xs"
                          title="Ver ficha o vista previa"
                        >
                          <ExternalLink className="w-4 h-4 text-muted" />
                        </a>
                      )}

                      {b.downloadUrl ? (
                        <button
                          onClick={() => handleImportUrl(b)}
                          disabled={importingId === b.id}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                          title="Importar este libro a la materia"
                        >
                          {importingId === b.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Importando...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Importar PDF</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted italic px-2">Solo referencia</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
