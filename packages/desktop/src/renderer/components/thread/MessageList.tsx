import { useStore } from '@/store'
import { Box, Loader2, Wrench, FileCode, Copy, Check } from 'lucide-react'
import { useState, useCallback } from 'react'

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [code])

  return (
    <div className="bg-codebox-code border border-codebox-border rounded-lg overflow-hidden mt-3 font-mono text-[12.5px]">
      {/* Code header matching reference */}
      <div className="bg-black/5 px-3 py-2 border-b border-codebox-border flex justify-between items-center text-codebox-secondary text-[11px]">
        <div className="flex items-center gap-2">
          <FileCode size={12} />
          <span>{language || 'typescript'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="bg-transparent border-none text-codebox-secondary cursor-pointer text-[11px] hover:text-codebox-primary flex items-center gap-1 transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} className="text-codebox-green" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-codebox-primary leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function MessageList() {
  const { activeThreadId, messages, isStreaming } = useStore()
  const threadMessages = activeThreadId ? messages[activeThreadId] || [] : []

  if (threadMessages.length === 0) return null

  return (
    <div className="w-full max-w-[760px] flex flex-col gap-6 pt-5 mt-auto mb-auto">
      {threadMessages.map((msg, i) => {
        const isLast = i === threadMessages.length - 1
        const isStreamingLast = isLast && isStreaming && msg.role === 'assistant'

        return (
          <div
            key={msg.id}
            className={`flex flex-col gap-2 leading-relaxed text-sm user-select-text ${
              msg.role === 'user'
                ? 'self-end bg-codebox-input border border-codebox-border px-4 py-2.5 rounded-xl max-w-[80%] text-codebox-primary'
                : 'self-start w-full text-codebox-primary'
            }`}
          >
            {/* Assistant header */}
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-2 text-xs text-codebox-secondary font-medium">
                <Box size={14} className="text-codebox-purple" strokeWidth={1.8} />
                <span>Eburon CodeBox</span>
                {isStreamingLast && <Loader2 size={12} className="animate-spin text-codebox-purple" />}
              </div>
            )}

            {/* Reasoning block */}
            {msg.reasoning && (
              <div className="text-xs text-codebox-muted italic border-l-2 border-codebox-border pl-3 py-1">
                {msg.reasoning}
              </div>
            )}

            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {msg.toolCalls.map((tc, j) => (
                  <div key={j} className="bg-codebox-card border border-codebox-border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-codebox-input border-b border-codebox-border text-[11px] text-codebox-secondary">
                      <Wrench size={12} className="text-codebox-purple" />
                      <span className="font-medium">{tc.name}</span>
                      <span className="text-codebox-muted font-mono text-[10px] truncate max-w-[300px]">{tc.args}</span>
                      {!tc.result && <Loader2 size={10} className="animate-spin text-codebox-purple ml-auto" />}
                    </div>
                    {tc.result && (
                      <pre className="p-3 text-[11px] text-codebox-secondary font-mono whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                        {tc.result}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Message content */}
            <div className="text-sm leading-relaxed">{msg.content}</div>

            {/* Code block with copy button */}
            {msg.code && <CodeBlock code={msg.code} />}
          </div>
        )
      })}
    </div>
  )
}
