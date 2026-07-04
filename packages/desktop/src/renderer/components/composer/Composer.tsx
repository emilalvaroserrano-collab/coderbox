import { useState, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { Plus, ArrowUp, GitBranch, Terminal, Loader2, FolderOpen, FileText, X } from 'lucide-react'

const MODE_TABS = ['local', 'worktree', 'cloud'] as const

export default function Composer() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const {
    activeMode, setActiveMode, addThread, addMessage, activeThreadId,
    setActiveView, setActiveThread, activeView, isStreaming, sendPrompt,
    toggleTerminal, isTerminalOpen,
    sourcePath, setSourcePath, attachedFiles, addAttachedFile, removeAttachedFile,
  } = useStore()

  const hasText = text.trim().length > 0

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && text.trim() && !isStreaming) {
      e.preventDefault()
      send()
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Allow newline
    }
  }, [text, isStreaming])

  // Attach a single file — opens OS file picker, reads content
  const handleAttachFile = useCallback(async () => {
    if (!window.electronAPI?.openFile) return
    const filePath = await window.electronAPI.openFile()
    if (!filePath) return

    const fileName = filePath.split('/').pop() || filePath

    // Read file content via IPC (max 50KB)
    let content: string | undefined
    let size: number | undefined
    if (window.electronAPI?.readFile) {
      const result = await window.electronAPI.readFile(filePath, 51200)
      content = result.content
      size = result.size
    }

    addAttachedFile({ path: filePath, name: fileName, content, size })
  }, [addAttachedFile])

  // Attach a source folder — sets the working directory for the AI
  const handleAttachFolder = useCallback(async () => {
    if (!window.electronAPI?.openDirectory) return
    const dirPath = await window.electronAPI.openDirectory()
    if (!dirPath) return

    setSourcePath(dirPath)
  }, [setSourcePath])

  const send = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const threadId = activeThreadId || `thread-${Date.now()}`
    const shortTitle = trimmed.slice(0, 24) + (trimmed.length > 24 ? '...' : '')

    if (!activeThreadId) {
      addThread({
        id: threadId,
        title: shortTitle,
        mode: activeMode,
        projectId: 'default',
        createdAt: Date.now(),
      })
      setActiveThread(threadId)
    }

    addMessage(threadId, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    })

    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    if (activeView === 'new-thread') {
      setActiveView('chat')
    }

    await sendPrompt(threadId, trimmed)
  }, [text, activeThreadId, activeMode, activeView, isStreaming])

  return (
    <footer className="absolute bottom-0 left-0 right-0 px-5 pb-4 bg-gradient-to-t from-codebox-bg from-65% to-transparent flex flex-col items-center pointer-events-none">
      {/* Attached files & source path indicators */}
      {(attachedFiles.length > 0 || sourcePath) && (
        <div className="w-full max-w-[720px] mb-2 flex flex-wrap gap-2 pointer-events-auto">
          {sourcePath && (
            <div className="flex items-center gap-1.5 bg-codebox-input border border-codebox-border rounded-full px-3 py-1 text-[11px] text-codebox-primary">
              <FolderOpen size={12} className="text-codebox-blue" />
              <span className="max-w-[200px] truncate">{sourcePath.split('/').pop()}</span>
              <button
                className="bg-transparent border-none cursor-pointer p-0 text-codebox-muted hover:text-codebox-primary"
                onClick={() => setSourcePath(null)}
                title="Remove source path"
              >
                <X size={12} />
              </button>
            </div>
          )}
          {attachedFiles.map((file) => (
            <div key={file.path} className="flex items-center gap-1.5 bg-codebox-input border border-codebox-border rounded-full px-3 py-1 text-[11px] text-codebox-primary">
              <FileText size={12} className="text-codebox-green" />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <button
                className="bg-transparent border-none cursor-pointer p-0 text-codebox-muted hover:text-codebox-primary"
                onClick={() => removeAttachedFile(file.path)}
                title="Remove file"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="w-full max-w-[720px] rounded-2xl border border-codebox-border shadow-[0_8px_30px_rgba(0,0,0,0.4)] bg-codebox-input pointer-events-auto focus-within:border-codebox-secondary transition-colors">
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent border-none outline-none px-3.5 py-3 text-sm text-codebox-primary placeholder:text-codebox-muted resize-none"
          style={{ minHeight: 40 }}
          placeholder={isStreaming ? 'Waiting for response...' : 'Ask anything or click mic for voice orb...'}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <div className="flex items-center justify-between px-3.5 pb-3 pt-1">
          <div className="flex items-center gap-0.5">
            {/* Attach file button */}
            <button
              className="bg-transparent border-none text-codebox-secondary cursor-pointer p-[6px] rounded-md hover:bg-white/5 hover:text-codebox-primary"
              title="Attach file"
              onClick={handleAttachFile}
            >
              <Plus size={20} />
            </button>
            {/* Attach source folder button */}
            <button
              className={`bg-transparent border-none cursor-pointer p-[6px] rounded-md hover:bg-white/5 ${sourcePath ? 'text-codebox-blue' : 'text-codebox-secondary'} hover:text-codebox-primary`}
              title="Set source code path"
              onClick={handleAttachFolder}
            >
              <FolderOpen size={18} />
            </button>
            {/* Terminal toggle */}
            <button
              className={`bg-transparent border-none cursor-pointer p-[6px] rounded-md hover:bg-white/5 ${isTerminalOpen ? 'text-codebox-green' : 'text-codebox-secondary'} hover:text-codebox-primary`}
              title="Toggle terminal"
              onClick={() => toggleTerminal()}
            >
              <Terminal size={18} />
            </button>
          </div>

          {/* Mode tabs inline on the left */}
          <div className="flex gap-3 text-[11.5px]">
            {MODE_TABS.map((mode) => (
              <span
                key={mode}
                className={`cursor-pointer capitalize ${activeMode === mode ? 'text-codebox-primary font-medium' : 'text-codebox-secondary hover:text-codebox-primary'}`}
                onClick={() => setActiveMode(mode)}
              >
                {mode}
              </span>
            ))}
          </div>

          {/* Send button */}
          <button
            disabled={!hasText || isStreaming}
            className="w-7 h-7 rounded-full bg-codebox-primary text-codebox-bg border-none flex items-center justify-center cursor-pointer transition-transform disabled:bg-codebox-border disabled:text-codebox-muted disabled:cursor-default enabled:hover:scale-105"
            onClick={send}
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>

      {/* Branch info */}
      <div className="w-full max-w-[720px] flex items-center justify-between pt-2.5 px-1.5 text-[11.5px] text-codebox-secondary pointer-events-auto">
        <div></div>
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-white/5 hover:text-codebox-primary transition-colors px-1.5 py-0.5 rounded" onClick={() => navigator.clipboard?.writeText('eb/codebox-main')}>
          <GitBranch size={14} />
          <span>eb/codebox-main</span>
        </div>
      </div>
    </footer>
  )
}