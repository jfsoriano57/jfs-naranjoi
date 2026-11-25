import { extractText } from "unpdf";
import mammoth from "mammoth";
import { GoogleGenAI } from "@google/genai";

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

/**
 * Extrae texto de un archivo PDF página por página.
 * Si las páginas tienen texto muy escaso (ejemplo: PDF escaneado), usa visión de Gemini como fallback.
 */
export async function extractTextFromPDF(
  buffer: ArrayBuffer,
  ai?: GoogleGenAI
): Promise<ExtractedPage[]> {
  try {
    const result = await extractText(new Uint8Array(buffer));
    const rawText = result.text;

    // Si unpdf devolvió un array de páginas o un string
    if (Array.isArray(rawText)) {
      const pages = (rawText as string[]).map((pageText, idx) => ({
        pageNumber: idx + 1,
        text: typeof pageText === "string" ? pageText.trim() : "",
      }));

      // Verificar si está prácticamente vacío (PDF escaneado)
      const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
      if (totalChars < 100 && ai && buffer.byteLength < 15 * 1024 * 1024) {
        console.log("PDF aparentemente escaneado; ejecutando OCR con Gemini...");
        return await extractPDFWithGeminiOCR(buffer, ai);
      }

      return pages.filter((p) => p.text.length > 0);
    } else if (typeof rawText === "string" && (rawText as string).trim().length > 0) {
      return [{ pageNumber: 1, text: (rawText as string).trim() }];
    }

    if (ai && buffer.byteLength < 15 * 1024 * 1024) {
      return await extractPDFWithGeminiOCR(buffer, ai);
    }

    return [];
  } catch (err) {
    console.warn("Fallo en extracción directa de PDF, intentando OCR...", err);
    if (ai) {
      return await extractPDFWithGeminiOCR(buffer, ai);
    }
    throw err;
  }
}

/**
 * OCR usando Gemini Flash enviando el documento completo
 */
async function extractPDFWithGeminiOCR(
  buffer: ArrayBuffer,
  ai: GoogleGenAI
): Promise<ExtractedPage[]> {
  const base64Data = Buffer.from(buffer).toString("base64");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "application/pdf",
            },
          },
          {
            text: "Extrae todo el texto legible de este documento de estudio. Conserva títulos, subtítulos, fórmulas y tablas. Mantén el orden lógico.",
          },
        ],
      },
    ],
  });

  const fullText = response.text || "";
  return [{ pageNumber: 1, text: fullText.trim() }];
}

/**
 * Extrae texto de un documento Word (.docx)
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<ExtractedPage[]> {
  const result = await mammoth.extractRawText({ buffer });
  return [{ pageNumber: 1, text: result.value.trim() }];
}

/**
 * Extrae texto de una imagen (foto de apunte, ejercicio manuscrito o pizarra)
 */
export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string,
  ai: GoogleGenAI
): Promise<ExtractedPage[]> {
  const base64Data = buffer.toString("base64");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType,
            },
          },
          {
            text: "Transcribe fielmente todo el texto, fórmulas matemáticas, ejercicios y anotaciones que aparecen en esta imagen o apunte de estudio.",
          },
        ],
      },
    ],
  });

  return [{ pageNumber: 1, text: (response.text || "").trim() }];
}

export type TextChunk = {
  pageNumber: number;
  content: string;
};

/**
 * Divide el texto en fragmentos (chunks) con solapamiento (overlap) para no perder contexto semántico.
 */
export function chunkPages(
  pages: ExtractedPage[],
  chunkSize = 1000,
  overlap = 150
): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ").trim();
    if (text.length <= chunkSize) {
      if (text.length > 20) {
        chunks.push({ pageNumber: page.pageNumber, content: text });
      }
      continue;
    }

    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;
      if (end < text.length) {
        // Cortar en un punto, punto y coma o espacio para no cortar palabras a la mitad
        const lastPunct = text.lastIndexOf(".", end);
        if (lastPunct > start + chunkSize / 2) {
          end = lastPunct + 1;
        } else {
          const lastSpace = text.lastIndexOf(" ", end);
          if (lastSpace > start + chunkSize / 2) {
            end = lastSpace;
          }
        }
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 30) {
        chunks.push({ pageNumber: page.pageNumber, content: chunkText });
      }

      start = end - overlap;
      if (start >= text.length - overlap) break;
    }
  }

  return chunks;
}
