import { useStore } from '@/store'
import { Code2, Shield, Layers, PenTool, Search, Plus } from 'lucide-react'
import { useState, useMemo } from 'react'

const ICON_MAP: Record<string, typeof Code2> = {
  Code2, Shield, Layers, PenTool,
}

export default function SkillsView() {
  const { skills, toggleSkill } = useStore()
  const [filter, setFilter] = useState<'all' | 'system' | 'custom'>('all')
  const [search, setSearch] = useState('')

  const systemCount = skills.filter((s) => s.type === 'system').length
  const customCount = skills.filter((s) => s.type === 'custom').length

  const displayed = useMemo(() => {
    return skills
      .filter((s) => filter === 'all' || s.type === filter)
      .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  }, [skills, filter, search])

  return (
    <div className="w-full max-w-[860px] flex flex-col gap-5 px-5 py-8 pb-24 mx-auto">
      <div className="flex justify-between items-center border-b border-codebox-border pb-4">
        <div>
          <h2 className="text-xl font-semibold text-codebox-primary">Skills &amp; Capabilities</h2>
          <p className="text-[12.5px] text-codebox-secondary mt-0.5">
            Configure specialized instructions, AST parsers, and custom tools for CodeBox.
          </p>
        </div>
        <button className="btn-primary flex items-center gap-1.5">
          <Plus size={14} />
          <span>Create Skill</span>
        </button>
      </div>

      <div className="flex justify-between items-center gap-3 mb-2">
        <div className="flex items-center gap-2 bg-codebox-input border border-codebox-border px-3 py-1.5 rounded-lg w-[260px]">
          <Search size={14} />
          <input
            className="bg-transparent border-none outline-none text-codebox-primary text-[12.5px] w-full"
            placeholder="Filter skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          <span
            className={`px-3 py-1.5 rounded-full text-xs cursor-pointer border border-transparent ${
              filter === 'all' ? 'bg-codebox-primary text-codebox-bg font-medium' : 'bg-codebox-input text-codebox-secondary hover:text-codebox-primary'
            }`}
            onClick={() => setFilter('all')}
          >
            All ({skills.length})
          </span>
          <span
            className={`px-3 py-1.5 rounded-full text-xs cursor-pointer border border-transparent ${
              filter === 'system' ? 'bg-codebox-primary text-codebox-bg font-medium' : 'bg-codebox-input text-codebox-secondary hover:text-codebox-primary'
            }`}
            onClick={() => setFilter('system')}
          >
            System ({systemCount})
          </span>
          <span
            className={`px-3 py-1.5 rounded-full text-xs cursor-pointer border border-transparent ${
              filter === 'custom' ? 'bg-codebox-primary text-codebox-bg font-medium' : 'bg-codebox-input text-codebox-secondary hover:text-codebox-primary'
            }`}
            onClick={() => setFilter('custom')}
          >
            Custom ({customCount})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3.5">
        {displayed.map((skill) => {
          const Icon = ICON_MAP[skill.icon] || Code2
          return (
            <div key={skill.id} className="card flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-current/10 ${
                    skill.type === 'custom' ? 'text-codebox-purple' : skill.id === 'cve-scanner' ? 'text-codebox-green' : 'text-codebox-blue'
                  }`}>
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-codebox-primary">{skill.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ml-1.5 ${
                      skill.type === 'system'
                        ? 'bg-codebox-input text-codebox-secondary'
                        : 'text-codebox-purple bg-codebox-purple/10'
                    }`}>
                      {skill.type}
                    </span>
                  </div>
                </div>
                <label className="relative inline-block w-9 h-5 flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => toggleSkill(skill.id)}
                    className="opacity-0 w-0 h-0"
                  />
                  <span className={`absolute cursor-pointer inset-0 rounded-full transition-colors duration-200 ${skill.enabled ? 'bg-codebox-blue' : 'bg-codebox-border'}`}>
                    <span className={`absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-transform duration-200 ${skill.enabled ? 'left-[17px]' : 'left-[3px]'}`} />
                  </span>
                </label>
              </div>
              <p className="text-[12.5px] text-codebox-secondary leading-relaxed">{skill.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
