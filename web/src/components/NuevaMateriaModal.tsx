"use client";

import { useState } from "react";
import { Plus, X, Calendar, GraduationCap, Palette } from "lucide-react";

const COLORES = [
  "#f97316", // Naranja
  "#3b82f6", // Azul
  "#10b981", // Verde
  "#8b5cf6", // Púrpura
  "#ec4899", // Rosa
  "#eab308", // Amarillo
  "#06b6d4", // Cyan
  "#64748b", // Gris pizarra
];

export function NuevaMateriaModal({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [career, setCareer] = useState("");
  const [term, setTerm] = useState("");
  const [color, setColor] = useState(COLORES[0]);
  const [examDate, setExamDate] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/materias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          career: career || null,
          term: term || null,
          color,
          exam_date: examDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la materia");

      setOpen(false);
      setName("");
      setCareer("");
      setTerm("");
      setExamDate("");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary"
      >
        <Plus className="w-4 h-4" />
        <span>Nueva Materia</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="card w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-muted hover:text-foreground rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 text-foreground">
              Agregar Nueva Materia
            </h3>
            <p className="text-sm text-muted mb-5">
              Crea una materia para organizar tus textos, apuntes y programas.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nombre de la materia *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Cálculo Multivariable, Física I, Anatomía"
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Carrera / Programa (opcional)</label>
                  <input
                    type="text"
                    value={career}
                    onChange={(e) => setCareer(e.target.value)}
                    placeholder="Ej. Ingeniería de Sistemas"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Semestre / Ciclo (opcional)</label>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Ej. 2026-I, 3er Semestre"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Próximo Examen o Entrega (opcional)</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-muted" />
                  Color identificativo
                </label>
                <div className="flex gap-2 flex-wrap mt-1.5">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? "Guardando..." : "Crear Materia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
