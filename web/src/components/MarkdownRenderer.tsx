"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full divide-y divide-border border border-border rounded-lg text-xs" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th className="bg-muted/10 px-3 py-2 text-left font-semibold" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="px-3 py-2 border-t border-border" {...props} />
          ),
          code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
            if (inline) {
              return (
                <code className="bg-muted/15 px-1.5 py-0.5 rounded text-orange-600 dark:text-orange-400 font-mono text-xs" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-stone-900 text-stone-100 p-3.5 rounded-xl overflow-x-auto text-xs font-mono my-3">
                <code {...props}>{children}</code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
