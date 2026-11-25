import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JFSP · Tutor de Estudio IA",
    short_name: "JFSP",
    description: "App de estudio inteligente con tus propios libros, programas y tutor IA",
    start_url: "/materias",
    display: "standalone",
    background_color: "#fffaf5",
    theme_color: "#ea580c",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
