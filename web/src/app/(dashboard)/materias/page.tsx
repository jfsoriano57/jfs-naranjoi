"use client";

import { useEffect, useState } from "react";
import { Subject } from "@/types";
import { NuevaMateriaModal } from "@/components/NuevaMateriaModal";
import Link from "next/link";
import { 
  BookOpen, 
  Calendar, 
  GraduationCap, 
  FileText, 
  ChevronRight, 
  PlusCircle,
  Clock
} from "lucide-react";

type SubjectWithCount = Subject & {
  documents?: [{ count: number }];
};

export default function MateriasPage() {
  const [subjects, setSubjects] = useState<SubjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  async function cargarMaterias() {
    try {
      const res = await fetch("/api/materias");
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarMaterias();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Mis Materias
          </h1>
          <p className="text-muted text-sm mt-1">
            Sube el programa, libros de texto en PDF y apuntes para cada asignatura.
          </p>
        </div>
        <NuevaMateriaModal onCreated={cargarMaterias} />
      </div>

      {/* Lista de materias */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-44 animate-pulse bg-muted/10 border-border" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="card text-center py-16 px-4 border-dashed border-2 border-border/80">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            Aún no has agregado ninguna materia
          </h3>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">
            Comienza creando tu primera materia (por ejemplo: Cálculo, Historia, Física) para subir tus libros y empezar a estudiar.
          </p>
          <div className="inline-block">
            <NuevaMateriaModal onCreated={cargarMaterias} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.map((sub) => {
            const docCount = sub.documents?.[0]?.count ?? 0;
            return (
              <Link
                key={sub.id}
                href={`/materias/${sub.id}`}
                className="card group hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between relative overflow-hidden"
              >
                {/* Barra de color de la materia */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: sub.color }}
                />

                <div className="pt-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                      {sub.name}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
                  </div>

                  {sub.career && (
                    <p className="text-xs text-muted flex items-center gap-1.5 mb-1">
                      <GraduationCap className="w-3.5 h-3.5 text-muted" />
                      <span>{sub.career}</span>
                      {sub.term && <span>• {sub.term}</span>}
                    </p>
                  )}

                  {sub.exam_date && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1.5 mt-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Examen: {new Date(sub.exam_date).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>{docCount} {docCount === 1 ? "material" : "materiales"}</span>
                  </span>
                  <span className="group-hover:underline font-medium text-foreground">
                    Ver biblioteca →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
