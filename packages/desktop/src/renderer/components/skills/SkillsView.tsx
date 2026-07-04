import { useStore } from '@/store'
import { ALL_SKILLS, SOURCE_CONFIG } from './skills-data'
import type { SkillDef } from './skills-data'
import {
  Code2, Shield, Layers, Search, Plus, LayoutGrid, List,
  Shuffle, GitMerge, Globe, Cloud, Container, Cpu, Film,
  Smartphone, Lightbulb, FileText, CheckCircle, GitPullRequest,
  Bug, FileDown,   Brain, Key, Rocket, ShieldCheck, Image,
  Sparkles, Bot, Palette, BrainCircuit, Wrench, Monitor,
  Eye, Database, Indent, GitBranch, BookOpen, FlaskConical,
  Package, Terminal, Play, Files, ArrowLeftRight, GitCommit,
  FolderPlus, Users, RefreshCw, MessageSquare, Hammer,
  UserCheck, Library, SlidersHorizontal, Lock, Compass, Save,
  Puzzle, Box, Captions, Clapperboard, FileEdit, HardDrive,
  Video, Subtitles,
} from 'lucide-react'
import { useState, useMemo } from 'react'

const ICON_MAP: Record<string, typeof Code2> = {
  Code2, Shield, Layers, Shuffle, GitMerge, Globe, Cloud,
  Container, Cpu, Film, Smartphone, Lightbulb, FileText,
  CheckCircle, GitPullRequest, Bug, FileDown, Brain, Key,
  Rocket, ShieldCheck, Image, Sparkles, Bot, Palette,
  BrainCircuit, Wrench, Monitor, Eye, Puzzle, Database,
  Indent, GitBranch, BookOpen, FlaskConical, Package, Terminal,
  Play, Files, ArrowLeftRight, GitCommit, FolderPlus, Users,
  RefreshCw, MessageSquare, Hammer, UserCheck, Library,
  SlidersHorizontal, Lock, Compass, Save, Box, FileEdit,
  Captions, Clapperboard, HardDrive, Video, Subtitles,
  Search, Plus, List, LayoutGrid,
}

type SourceFilter = 'all' | 'opencode' | 'claude' | 'codex' | 'hermes'
type ViewMode = 'grid' | 'list'

export default function SkillsView() {
  const { skills, toggleSkill } = useStore()
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'system' | 'custom'>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const sourceCounts = useMemo(() => ({
    opencode: skills.filter(s => s.source === 'opencode').length,
    claude: skills.filter(s => s.source === 'claude').length,
    codex: skills.filter(s => s.source === 'codex').length,
    hermes: skills.filter(s => s.source === 'hermes').length,
  }), [skills])

  const displayed = useMemo(() => {
    return skills
      .filter((s) => sourceFilter === 'all' || s.source === sourceFilter)
      .filter((s) => typeFilter === 'all' || s.type === typeFilter)
      .filter((s) => !search
        || s.name.toLowerCase().includes(search.toLowerCase())
        || s.description.toLowerCase().includes(search.toLowerCase())
        || (s.tags && s.tags.some(t => t.includes(search.toLowerCase()))),
      )
  }, [skills, sourceFilter, typeFilter, search])

  return (
    <div className="w-full max-w-[960px] flex flex-col gap-5 px-5 py-8 pb-24 mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-codebox-border pb-4">
        <div>
          <h2 className="text-xl font-semibold text-codebox-primary">Skills &amp; Capabilities</h2>
          <p className="text-[12.5px] text-codebox-secondary mt-0.5">
            {skills.length} skills across {Object.keys(SOURCE_CONFIG).length} engine ecosystems
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3.5 py-2 bg-codebox-primary text-codebox-bg rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity">
          <Plus size={14} />
          <span>Create Skill</span>
        </button>
      </div>

      {/* Source filter tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'opencode', 'claude', 'codex', 'hermes'] as const).map((src) => {
          const count = src === 'all' ? skills.length : sourceCounts[src]
          const cfg = src !== 'all' ? SOURCE_CONFIG[src] : null
          return (
            <span
              key={src}
              className={`px-3 py-1.5 rounded-full text-xs cursor-pointer border transition-all ${
                sourceFilter === src
                  ? cfg
                    ? `${cfg.color} border-current font-medium`
                    : 'bg-codebox-primary text-codebox-bg border-transparent font-medium'
                  : 'bg-codebox-input text-codebox-secondary border-transparent hover:text-codebox-primary hover:border-codebox-border'
              }`}
              onClick={() => setSourceFilter(src)}
            >
              {src === 'all' ? 'All' : cfg!.label} ({count})
            </span>
          )
        })}
      </div>

      {/* Toolbar: search, type filter, view toggle */}
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-2 bg-codebox-input border border-codebox-border px-3 py-1.5 rounded-lg flex-1 max-w-[320px]">
          <Search size={14} className="text-codebox-secondary" />
          <input
            className="bg-transparent border-none outline-none text-codebox-primary text-[12.5px] w-full placeholder:text-codebox-muted"
            placeholder="Search by name, description, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-codebox-input rounded-lg p-0.5">
            {(['all', 'system', 'custom'] as const).map((t) => (
              <span
                key={t}
                className={`px-2.5 py-1 rounded-md text-[11px] cursor-pointer font-medium ${
                  typeFilter === t
                    ? 'bg-codebox-card text-codebox-primary shadow-sm'
                    : 'text-codebox-secondary hover:text-codebox-primary'
                }`}
                onClick={() => setTypeFilter(t)}
              >
                {t === 'all' ? 'All' : t === 'system' ? 'System' : 'Custom'}
              </span>
            ))}
          </div>
          <div className="flex gap-0.5 bg-codebox-input rounded-lg p-0.5">
            <button
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-codebox-card text-codebox-primary shadow-sm' : 'text-codebox-secondary hover:text-codebox-primary'}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-codebox-card text-codebox-primary shadow-sm' : 'text-codebox-secondary hover:text-codebox-primary'}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-codebox-muted gap-2">
          <Search size={32} strokeWidth={1.5} />
          <p className="text-sm">No skills match your filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <GridView skills={displayed} toggleSkill={toggleSkill} />
      ) : (
        <ListView skills={displayed} toggleSkill={toggleSkill} />
      )}
    </div>
  )
}

function GridView({ skills, toggleSkill }: { skills: SkillDef[]; toggleSkill: (id: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3.5">
      {skills.map((skill) => {
        const Icon = ICON_MAP[skill.icon] || Code2
        const cfg = SOURCE_CONFIG[skill.source]
        return (
          <div key={skill.id} className="bg-codebox-card border border-codebox-border rounded-xl p-4 flex flex-col gap-3 hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start gap-3">
              <div className="flex gap-3 items-center min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-current/10 text-codebox-blue`}>
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-sm text-codebox-primary block truncate">{skill.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.color} inline-block mt-0.5`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
              <ToggleSwitch checked={skill.enabled} onChange={() => toggleSkill(skill.id)} />
            </div>
            <p className="text-[12.5px] text-codebox-secondary leading-relaxed line-clamp-2">{skill.description}</p>
            {skill.tags && skill.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {skill.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-codebox-input text-codebox-muted font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ListView({ skills, toggleSkill }: { skills: SkillDef[]; toggleSkill: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[36px_1fr_100px_80px_36px] gap-3 px-4 py-2 text-[11px] text-codebox-muted uppercase tracking-wider font-medium border-b border-codebox-border">
        <span />
        <span>Name</span>
        <span>Source</span>
        <span>Type</span>
        <span />
      </div>
      {skills.map((skill) => {
        const Icon = ICON_MAP[skill.icon] || Code2
        const cfg = SOURCE_CONFIG[skill.source]
        return (
          <div
            key={skill.id}
            className="grid grid-cols-[36px_1fr_100px_80px_36px] gap-3 items-center px-4 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-codebox-input text-codebox-secondary group-hover:text-codebox-blue transition-colors">
              <Icon size={15} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <span className="text-[13px] font-medium text-codebox-primary block truncate">{skill.name}</span>
              <span className="text-[11px] text-codebox-muted block truncate">{skill.description}</span>
            </div>
            <div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.color} inline-block`}>
                {cfg.label}
              </span>
            </div>
            <div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                skill.type === 'system'
                  ? 'bg-codebox-input text-codebox-secondary'
                  : 'text-codebox-purple bg-codebox-purple/10'
              }`}>
                {skill.type}
              </span>
            </div>
            <ToggleSwitch checked={skill.enabled} onChange={() => toggleSkill(skill.id)} />
          </div>
        )
      })}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-block w-9 h-5 flex-shrink-0 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="opacity-0 w-0 h-0"
      />
      <span className={`absolute cursor-pointer inset-0 rounded-full transition-colors duration-200 ${checked ? 'bg-codebox-blue' : 'bg-codebox-border'}`}>
        <span className={`absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-transform duration-200 ${checked ? 'left-[17px]' : 'left-[3px]'}`} />
      </span>
    </label>
  )
}
