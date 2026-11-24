"use client";

import { useEffect, useState, use } from "react";
import { Subject, DocumentItem } from "@/types";
import { SubirMaterialModal } from "@/components/SubirMaterialModal";
import { BuscarLibroModal } from "@/components/BuscarLibroModal";
import { HerramientasEstudioTab } from "@/components/HerramientasEstudioTab";
import Link from "next/link";
import { 
  ArrowLeft, 
  BookOpen, 
  FileText, 
  Calendar, 
  GraduationCap, 
  MessageSquare,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Clock,
  Layers,
  Search
} from "lucide-react";

export default function MateriaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: subjectId } = use(params);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function cargarDatos() {
    try {
      // 1. Cargar datos de la materia
      const resSub = await fetch("/api/materias");
      if (resSub.ok) {
        const subs: Subject[] = await resSub.json();
        const actual = subs.find((s) => s.id === subjectId) || null;
        setSubject(actual);
      }

      // 2. Cargar documentos
      const resDocs = await fetch(`/api/materias/${subjectId}/materiales`);
      if (resDocs.ok) {
        const docs = await resDocs.json();
        setDocuments(docs);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, [subjectId]);

  if (loading) {
    return <div className="p-8 text-center text-muted">Cargando biblioteca de la materia...</div>;
  }

  if (!subject) {
    return (
      <div className="card text-center py-12">
        <p className="text-muted">Materia no encontrada.</p>
        <Link href="/materias" className="btn-primary mt-4 inline-flex">
          Volver a Mis Materias
        </Link>
      </div>
    );
  }

  const libros = documents.filter((d) => d.kind === "texto_basico");
  const programas = documents.filter((d) => d.kind === "programa");
  const otrosDocs = documents.filter((d) => d.kind !== "texto_basico" && d.kind !== "programa");

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Botón Volver y Cabecera de Materia */}
      <div>
        <Link
          href="/materias"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground font-medium mb-3 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Mis Materias</span>
        </Link>

        <div className="card border-l-4 relative overflow-hidden" style={{ borderLeftColor: subject.color }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {subject.name}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted">
                {subject.career && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    {subject.career} {subject.term && `(${subject.term})`}
                  </span>
                )}
                {subject.exam_date && (
                  <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold">
                    <Calendar className="w-4 h-4" />
                    Examen: {new Date(subject.exam_date).toLocaleDateString()}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {documents.length} {documents.length === 1 ? "documento" : "documentos"}
                </span>
              </div>
            </div>

            {/* Acciones principales */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/tutor?materia=${subject.id}`}
                className="btn-secondary"
              >
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Consultar Tutor</span>
              </Link>
              <BuscarLibroModal subjectId={subject.id} onImported={cargarDatos} />
              <SubirMaterialModal subjectId={subject.id} onUploaded={cargarDatos} />
            </div>
          </div>
        </div>
      </div>

      {/* Herramientas de Estudio Inteligente (Fase 5) */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span>Herramientas de Estudio Inteligente</span>
        </h2>
        <HerramientasEstudioTab subjectId={subject.id} examDate={subject.exam_date} />
      </div>

      {/* Lista de materiales */}
      <div className="space-y-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Biblioteca de la Materia</span>
          </h2>
          <span className="text-xs text-muted">
            Los materiales procesados alimentan las respuestas de tu Tutor IA
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="card text-center py-12 border-dashed">
            <Layers className="w-12 h-12 text-muted/60 mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground">
              Aún no has subido materiales para esta materia
            </h3>
            <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-5">
              Sube el libro de texto en PDF, programa de la materia o apuntes para que la IA responda citando la página exacta.
            </p>
            <SubirMaterialModal subjectId={subject.id} onUploaded={cargarDatos} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="card flex flex-col justify-between hover:border-primary/40 transition">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    {doc.status === "listo" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        Listo
                      </span>
                    ) : doc.status === "procesando" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                        Procesando
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        Error
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-foreground line-clamp-2 mb-1">
                    {doc.title}
                  </h3>

                  <p className="text-xs text-muted capitalize">
                    Tipo: {doc.kind.replace("_", " ")}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted">
                  <span>
                    {doc.pages ? `${doc.pages} pág.` : ""} {doc.size_bytes ? `• ${(doc.size_bytes / (1024 * 1024)).toFixed(1)} MB` : ""}
                  </span>
                  <span className="font-medium text-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
