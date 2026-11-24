import { NextResponse } from "next/server";

export type BookSearchResult = {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  source: "Open Library" | "Google Books" | "Internet Archive";
  downloadUrl?: string;
  previewUrl?: string;
  coverUrl?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const query = encodeURIComponent(q.trim());
  const results: BookSearchResult[] = [];

  try {
    // 1. Consulta a Open Library (Libros abiertos y dominio público)
    const olPromise = fetch(
      `https://openlibrary.org/search.json?q=${query}&limit=5&fields=key,title,author_name,first_publish_year,ia,cover_i,has_fulltext`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.docs && Array.isArray(data.docs)) {
          for (const doc of data.docs) {
            const hasIa = doc.ia && Array.isArray(doc.ia) && doc.ia.length > 0;
            const iaId = hasIa ? doc.ia[0] : null;

            results.push({
              id: `ol_${doc.key}`,
              title: doc.title,
              authors: doc.author_name || ["Autor desconocido"],
              year: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
              source: "Open Library",
              coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
              previewUrl: `https://openlibrary.org${doc.key}`,
              downloadUrl: iaId ? `https://archive.org/download/${iaId}/${iaId}.pdf` : undefined,
            });
          }
        }
      })
      .catch((e) => console.warn("Error OpenLibrary:", e));

    // 2. Consulta a Google Books (Metadatos bibliográficos y libros abiertos)
    const gbPromise = fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&printType=books`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            const vi = item.volumeInfo || {};
            const accessInfo = item.accessInfo || {};
            const pdf = accessInfo.pdf || {};
            const downloadUrl = pdf.isAvailable && pdf.downloadLink ? pdf.downloadLink : undefined;

            results.push({
              id: `gb_${item.id}`,
              title: vi.title || "Sin título",
              authors: vi.authors || ["Autor desconocido"],
              year: vi.publishedDate ? vi.publishedDate.slice(0, 4) : undefined,
              source: "Google Books",
              coverUrl: vi.imageLinks?.thumbnail?.replace("http://", "https://"),
              previewUrl: vi.previewLink || vi.infoLink,
              downloadUrl,
            });
          }
        }
      })
      .catch((e) => console.warn("Error GoogleBooks:", e));

    await Promise.allSettled([olPromise, gbPromise]);

    return NextResponse.json({ results });
  } catch (err: unknown) {
    console.error("Error en búsqueda de libros:", err);
    return NextResponse.json({ error: "Error en la búsqueda de libros" }, { status: 500 });
  }
}
