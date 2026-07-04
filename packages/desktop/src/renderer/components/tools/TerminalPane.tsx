import { useState, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { X } from 'lucide-react'

export default function TerminalPane() {
  const { isTerminalOpen, toggleTerminal } = useStore()
  const [history, setHistory] = useState<string[]>([
    '\x1b[1;35m◆ Eburon CodeBox Terminal\x1b[0m',
    '',
    '\x1b[2m$ git status\x1b[0m',
    'On branch eb/codebox-main',
    'nothing to commit, working tree clean',
    '',
  ])
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleEnter = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !input.trim()) return
    const cmd = input.trim()
    setHistory((h) => [...h, `\x1b[1;36m$ ${cmd}\x1b[0m`])
    setInput('')

    if (cmd === 'clear') {
      setHistory([])
      return
    }
    if (cmd === 'help') {
      setHistory((h) => [...h, 'Commands: git status, git log, npm test, ls, pwd, clear, help'])
      return
    }
    if (cmd.startsWith('git')) {
      setHistory((h) => [...h, `\x1b[2mExecuting: ${cmd}\x1b[0m`, '\x1b[32mDone.\x1b[0m'])
      return
    }
    setHistory((h) => [...h, `\x1b[31mcommand not found: ${cmd.split(' ')[0]}\x1b[0m`])
  }, [input])

  if (!isTerminalOpen) return null

  return (
    <div className="absolute bottom-[130px] left-0 right-0 h-[220px] bg-[#0d0d0f] border-t border-codebox-border flex flex-col z-10 font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-codebox-border bg-codebox-sidebar">
        <span className="text-[11px] text-codebox-secondary font-sans font-medium">Terminal</span>
        <button
          className="bg-transparent border-none text-codebox-secondary cursor-pointer p-0.5 rounded hover:bg-white/5 hover:text-codebox-primary"
          onClick={toggleTerminal}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 leading-relaxed" onClick={() => inputRef.current?.focus()}>
        {history.map((line, i) => {
          if (line.includes('\x1b[')) {
            return <pre key={i} className="whitespace-pre-wrap break-all">{line.replace(/\x1b\[[0-9;]*m/g, '')}</pre>
          }
          return <div key={i} className="whitespace-pre-wrap break-all text-codebox-secondary">{line}</div>
        })}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-codebox-green">$</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-codebox-primary font-mono text-xs"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleEnter}
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}
