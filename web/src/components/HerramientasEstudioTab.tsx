"use client";

import { useState } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { 
  FileText, 
  HelpCircle, 
  CreditCard, 
  CalendarRange, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  RotateCcw
} from "lucide-react";

type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

type Flashcard = {
  front: string;
  back: string;
};

export function HerramientasEstudioTab({
  subjectId,
  examDate,
}: {
  subjectId: string;
  examDate: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"resumen" | "cuestionario" | "flashcards" | "plan">("resumen");
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  
  // Estados para resultados
  const [resumenResult, setResumenResult] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ejecutarAccion(action: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/materias/${subjectId}/herramientas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, topic, examDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar la herramienta");

      if (action === "resumen") setResumenResult(data.result);
      if (action === "cuestionario") {
        setQuizQuestions(data.questions || []);
        setSelectedAnswers({});
        setShowAnswers(false);
      }
      if (action === "flashcards") {
        setFlashcards(data.flashcards || []);
        setFlippedCards({});
      }
      if (action === "plan_estudio") setPlanResult(data.result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al generar contenido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-6">
      {/* Botones de cambio de herramienta */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("resumen")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "resumen" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-accent"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Resumen por Tema</span>
        </button>

        <button
          onClick={() => setActiveTab("cuestionario")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "cuestionario" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-accent"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Test de Práctica</span>
        </button>

        <button
          onClick={() => setActiveTab("flashcards")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "flashcards" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-accent"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Flashcards</span>
        </button>

        <button
          onClick={() => setActiveTab("plan")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "plan" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-accent"
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          <span>Plan de Estudio</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
          {error}
        </div>
      )}

      {/* Pestaña: Resumen */}
      {activeTab === "resumen" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Tema específico a resumir (ej. Leyes de Newton, Integrales triples, Ciclo celular)..."
              className="input flex-1 text-sm py-2"
            />
            <button
              onClick={() => ejecutarAccion("resumen")}
              disabled={loading}
              className="btn-primary text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar Resumen"}
            </button>
          </div>

          {resumenResult && (
            <div className="p-4 rounded-xl bg-accent/40 border border-border mt-4">
              <MarkdownRenderer content={resumenResult} />
            </div>
          )}
        </div>
      )}

      {/* Pestaña: Cuestionario */}
      {activeTab === "cuestionario" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              Genera 5 preguntas tipo examen basadas en los libros y materiales subidos.
            </p>
            <button
              onClick={() => ejecutarAccion("cuestionario")}
              disabled={loading}
              className="btn-primary text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Nuevo Test"}
            </button>
          </div>

          {quizQuestions.length > 0 && (
            <div className="space-y-4 mt-4">
              {quizQuestions.map((q, qIndex) => {
                const userSelected = selectedAnswers[qIndex];
                const isCorrect = userSelected === q.answerIndex;

                return (
                  <div key={qIndex} className="p-4 rounded-xl border border-border bg-card/70 space-y-3">
                    <p className="font-semibold text-sm text-foreground">
                      {qIndex + 1}. {q.question}
                    </p>

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIndex) => {
                        const isChosen = userSelected === optIndex;
                        const isRightAnswer = q.answerIndex === optIndex;

                        let optClasses = "border-border hover:bg-accent text-foreground";
                        if (showAnswers) {
                          if (isRightAnswer) {
                            optClasses = "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 font-semibold";
                          } else if (isChosen && !isRightAnswer) {
                            optClasses = "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700";
                          }
                        } else if (isChosen) {
                          optClasses = "border-primary bg-primary/10 text-primary font-semibold";
                        }

                        return (
                          <button
                            key={optIndex}
                            type="button"
                            onClick={() => !showAnswers && setSelectedAnswers({ ...selectedAnswers, [qIndex]: optIndex })}
                            className={`w-full text-left p-2.5 rounded-lg border text-xs transition flex items-center justify-between ${optClasses}`}
                          >
                            <span>{opt}</span>
                            {showAnswers && isRightAnswer && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                            {showAnswers && isChosen && !isRightAnswer && <XCircle className="w-4 h-4 text-red-600" />}
                          </button>
                        );
                      })}
                    </div>

                    {showAnswers && (
                      <div className="text-xs text-muted bg-muted/10 p-2.5 rounded-lg">
                        <span className="font-semibold text-foreground">Explicación: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex justify-end pt-2">
                {!showAnswers ? (
                  <button
                    onClick={() => setShowAnswers(true)}
                    disabled={Object.keys(selectedAnswers).length === 0}
                    className="btn-primary text-xs"
                  >
                    Verificar Respuestas
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedAnswers({});
                      setShowAnswers(false);
                    }}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reintentar</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pestaña: Flashcards */}
      {activeTab === "flashcards" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              Tarjetas interactivas para memorizar conceptos y fórmulas clave de la materia.
            </p>
            <button
              onClick={() => ejecutarAccion("flashcards")}
              disabled={loading}
              className="btn-primary text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar Flashcards"}
            </button>
          </div>

          {flashcards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 mt-4">
              {flashcards.map((f, idx) => {
                const isFlipped = flippedCards[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => setFlippedCards({ ...flippedCards, [idx]: !isFlipped })}
                    className="card min-h-[140px] cursor-pointer hover:border-primary/50 transition flex flex-col justify-between select-none bg-accent/20"
                  >
                    <span className="text-[10px] font-bold text-muted uppercase">
                      {isFlipped ? "Respuesta / Definición" : "Concepto o Pregunta"} (Toca para girar)
                    </span>
                    <p className={`text-xs my-auto font-medium ${isFlipped ? "text-primary font-semibold" : "text-foreground"}`}>
                      {isFlipped ? f.back : f.front}
                    </p>
                    <span className="text-[10px] text-muted text-right">Tarjeta {idx + 1} de {flashcards.length}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pestaña: Plan de estudio */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              {examDate
                ? `Plan organizado para tu examen fechado el ${new Date(examDate).toLocaleDateString()}.`
                : "Cronograma estructurado según los temas del programa para organizar tus semanas."}
            </p>
            <button
              onClick={() => ejecutarAccion("plan_estudio")}
              disabled={loading}
              className="btn-primary text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Plan de Estudio"}
            </button>
          </div>

          {planResult && (
            <div className="p-4 rounded-xl bg-accent/40 border border-border mt-4">
              <MarkdownRenderer content={planResult} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
