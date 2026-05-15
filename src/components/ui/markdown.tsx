'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  content: string
  className?: string
  compact?: boolean
}

/**
 * Lightweight Markdown renderer tuned for AI-generated agriculture advice.
 * Supports GitHub-flavoured markdown: tables, strikethrough, task lists, autolinks.
 */
export function Markdown({ content, className = '', compact = false }: MarkdownProps) {
  const textSize = compact ? 'text-sm' : 'text-[15px]'
  return (
    <div className={`markdown ${textSize} leading-relaxed text-slate-800 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-900 mt-3 mb-1.5 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-900 mt-3 mb-1 first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="marker:text-emerald-600">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className: cn }) => {
            const isBlock = cn?.includes('language-')
            if (isBlock) {
              return (
                <pre className="bg-slate-900 text-slate-100 rounded-md p-3 overflow-x-auto my-2 text-xs">
                  <code>{children}</code>
                </pre>
              )
            }
            return (
              <code className="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded text-[0.9em] font-mono">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-300 pl-3 italic text-slate-600 my-2">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-emerald-700 underline hover:text-emerald-800">
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-slate-200" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-slate-100 align-top">{children}</td>
          ),
          tr: ({ children }) => <tr className="even:bg-slate-50/50">{children}</tr>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
