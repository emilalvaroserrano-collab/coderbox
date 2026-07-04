import { useStore } from '@/store'
import ModelSelector from '@/components/composer/ModelSelector'

export function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 max-w-[420px] text-center">
      {/* Eburon CodeBox logo */}
      <svg className="w-14 h-14 text-codebox-primary mb-1" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="12" width="48" height="40" rx="8" />
        <path d="M22 26l10 10-10 10" />
        <path d="M42 46l-8-8" />
      </svg>

      {/* Welcome title */}
      <h1 className="text-[22px] font-medium text-codebox-primary tracking-[-0.02em]">
        Let's build
      </h1>
      <p className="text-[13px] text-codebox-muted -mt-2">
        Eburon CodeBox v0.1 is ready. Start typing or use the voice orb.
      </p>

      {/* Model selector with relative wrapper for absolute dropdown positioning */}
      <div className="relative w-full flex justify-center pt-4">
        <ModelSelector />
      </div>
    </div>
  )
}
