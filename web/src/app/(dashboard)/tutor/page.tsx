"use client";

import { useState, useEffect, useRef } from "react";
import { Subject, Message, ChunkCitation } from "@/types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { 
  Send, 
  Sparkles, 
  BookOpen, 
  Bot, 
  User as UserIcon, 
  Layers, 
  Check, 
  AlertCircle,
  FileText,
  Bookmark
} from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function TutorPage() {
  const searchParams = useSearchParams();
  const materiaParam = searchParams.get("materia");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/materias")
      .then((r) => r.json())
      .then((data: Subject[]) => {
        if (Array.isArray(data)) {
          setSubjects(data);
          if (materiaParam && data.some((s) => s.id === materiaParam)) {
            setSelectedSubjects([materiaParam]);
          } else if (data.length > 0) {
            setSelectedSubjects([data[0].id]);
          }
        }
      });
  }, [materiaParam]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function toggleSubject(id: string) {
    if (selectedSubjects.includes(id)) {
      if (selectedSubjects.length > 1) {
        setSelectedSubjects(selectedSubjects.filter((s) => s !== id));
      }
    } else {
      setSelectedSubjects([...selectedSubjects, id]);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || selectedSubjects.length === 0) return;

    const userMessage: Message = {
      id: Date.now(),
      conversation_id: conversationId || "temp",
      user_id: "me",
      role: "user",
      content: input.trim(),
      citations: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          subjectIds: selectedSubjects,
          conversationId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al consultar al tutor");
      }

      setConversationId(data.conversationId);
      const assistantMessage: Message = {
        id: Date.now() + 1,
        conversation_id: data.conversationId,
        user_id: "assistant",
        role: "assistant",
        content: data.answer,
        citations: data.citations || [],
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la respuesta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] animate-in fade-in duration-300">
      {/* Selector de materias para consulta multi-materia */}
      <div className="bg-card border border-border rounded-2xl p-3.5 mb-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Layers className="w-4 h-4 text-primary" />
          <span>Materias activas en esta consulta:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {subjects.map((sub) => {
            const isSelected = selectedSubjects.includes(sub.id);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => toggleSubject(sub.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-accent/60 text-muted hover:text-foreground border border-border"
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? "#ffffff" : sub.color }}
                />
                <span>{sub.name}</span>
                {isSelected && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200 mb-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 card border-dashed">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-primary flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              ¿Qué deseas estudiar o aclarar hoy?
            </h3>
            <p className="text-xs text-muted max-w-md mt-1 mb-6">
              Pregunta cualquier concepto, pide explicaciones paso a paso de ejercicios o pide resúmenes basados en tus materias seleccionadas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-lg w-full text-xs">
              <button
                onClick={() => setInput("Explícame los conceptos clave del primer tema según mis materiales")}
                className="p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-accent transition text-muted hover:text-foreground"
              >
                💡 "Explícame los conceptos clave del primer tema..."
              </button>
              <button
                onClick={() => setInput("Resuelve un ejercicio típico de examen paso a paso con fórmulas")}
                className="p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-accent transition text-muted hover:text-foreground"
              >
                📐 "Resuelve un ejercicio típico de examen con fórmulas..."
              </button>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-card border border-border text-foreground rounded-tl-none"
                }`}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div>
                    <MarkdownRenderer content={m.content} />

                    {/* Citas de libros */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <p className="text-[11px] font-bold text-muted flex items-center gap-1.5 mb-2">
                          <Bookmark className="w-3.5 h-3.5 text-primary" />
                          <span>Fuentes citadas en tus materiales:</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.citations.map((c, i) => (
                            <span
                              key={i}
                              title={c.snippet}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-accent text-foreground border border-border/80"
                            >
                              <FileText className="w-3 h-3 text-primary" />
                              <span className="font-semibold">{c.document_title}</span>
                              {c.page && <span className="text-muted">(Pág. {c.page})</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-accent text-foreground border border-border flex items-center justify-center flex-shrink-0 mt-1">
                  <UserIcon className="w-4 h-4 text-muted" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="card py-3 px-4 rounded-tl-none text-xs text-muted flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-spin" />
              <span>Analizando tus libros y generando respuesta con fórmulas...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de consulta */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu duda, pregunta o ejercicio aquí..."
          disabled={loading || selectedSubjects.length === 0}
          className="input flex-1 py-3"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || selectedSubjects.length === 0}
          className="btn-primary px-5"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Preguntar</span>
        </button>
      </form>
    </div>
  );
}
