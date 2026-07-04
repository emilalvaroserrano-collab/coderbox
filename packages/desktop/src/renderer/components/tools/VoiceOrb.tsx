import { useStore } from '@/store'
import { Mic } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'

export default function VoiceOrb() {
  const { isOrbVisible, isOrbConnected, toggleOrbConnection, theme } = useStore()
  const [pos, setPos] = useState({ x: window.innerWidth - 110, y: window.innerHeight - 160 })
  const isDraggingRef = useRef(false)
  const startPosRef = useRef<{x: number; y: number}>({x: 0, y: 0})
  const orbStartPosRef = useRef({ x: 0, y: 0 })
  const hasDraggedRef = useRef(false)

  const tooltipText = isOrbConnected ? 'Listening... (Connected to CodeBox WS)' : 'Voice Agent: Idle (Click to connect)'

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true
    hasDraggedRef.current = false
    startPosRef.current = { x: e.clientX, y: e.clientY }
    orbStartPosRef.current = { ...pos }

    const el = e.currentTarget as HTMLElement
    el.style.position = 'fixed'
    el.style.left = pos.x + 'px'
    el.style.top = pos.y + 'px'
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    hasDraggedRef.current = true
    const dx = e.clientX - startPosRef.current.x
    const dy = e.clientY - startPosRef.current.y
    setPos({
      x: Math.max(10, Math.min(window.innerWidth - 80, orbStartPosRef.current.x + dx)),
      y: Math.max(10, Math.min(window.innerHeight - 80, orbStartPosRef.current.y + dy)),
    })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    const dx = Math.abs(e.clientX - startPosRef.current.x)
    const dy = Math.abs(e.clientY - startPosRef.current.y)
    if (dx < 3 && dy < 3) {
      toggleOrbConnection()
    }
  }, [toggleOrbConnection])

  const isConnected = isOrbConnected

  if (!isOrbVisible) return null

  const bgColor = isConnected
    ? 'conic-gradient(from 0deg, #10b981, #06b6d4, #3b82f6, #10b981)'
    : 'conic-gradient(from 0deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)'

  const glow = isConnected
    ? '0 0 30px rgba(16, 185, 129, 0.8)'
    : '0 0 25px rgba(139, 92, 246, 0.6), 0 0 50px rgba(59, 130, 246, 0.4)'

  const coreBg = isConnected
    ? 'radial-gradient(circle, #6ee7b7 0%, #10b981 100%)'
    : 'radial-gradient(circle, #a78bfa 0%, #3b82f6 100%)'

  const coreShadow = isConnected ? '0 0 20px #6ee7b7' : '0 0 15px #a78bfa'

  return (
    <div
      className="fixed z-[9999] flex items-center justify-center touch-none select-none pointer-events-auto"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Tooltip */}
      <div
        className="absolute -top-9 whitespace-nowrap rounded-full text-[11px] font-medium pointer-events-none transition-opacity"
        style={{
          background: theme === 'dark' ? 'rgba(17, 17, 19, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          border: `1px solid ${theme === 'dark' ? '#27272b' : '#e1e1e6'}`,
          padding: '4px 10px',
          color: theme === 'dark' ? '#f4f4f6' : '#18181b',
        }}
      >
        {tooltipText}
      </div>

      {/* Outer orb with rotation animation */}
      <div
        className="voice-orb-outer voice-orb-show"
        style={{
          width: 70, height: 70, borderRadius: '50%',
          background: bgColor,
          boxShadow: glow,
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        }}
      >
        {/* Inner dark circle */}
        <div className="absolute inset-[2px] rounded-full bg-[#0d0d0f]" style={{ zIndex: 1 }} />

        {/* Pulsing glow overlay */}
        <div
          className="absolute -inset-1.5 rounded-full"
          style={{ background: bgColor, filter: 'blur(10px)', opacity: 0.7, animation: 'pulseGlow 2.5s ease-in-out infinite alternate', zIndex: 0 }}
        />

        {/* Inner core with microphone icon */}
        <div
          className="orb-core"
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: coreBg,
            boxShadow: coreShadow,
            animation: 'corePulse 1.8s ease-in-out infinite alternate',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Mic size={18} className="text-white" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  )
}
