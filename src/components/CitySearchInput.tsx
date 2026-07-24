import { useEffect, useRef, useState } from 'react'
import { searchCities } from '../api/footprint'
import { countryName } from '../lib/country'
import type { FootprintCityResult } from '../types'

/**
 * City autocomplete backed by the footprint data layer.
 *
 * The point of resolving a city here — rather than free-typing a name — is that
 * the chosen result carries the country code and the coordinate from the
 * dataset. The server looks the coordinate up again on save, so this is only
 * about helping the user land on the right city; it is not the source of truth.
 */

interface CitySearchInputProps {
  selected: FootprintCityResult | null
  onSelect: (city: FootprintCityResult) => void
  onClear: () => void
}

export default function CitySearchInput({ selected, onSelect, onClear }: CitySearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FootprintCityResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (selected || q.length === 0) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const ticket = ++seq.current
    const timer = setTimeout(async () => {
      try {
        const found = await searchCities(q, { limit: 8 })
        // A slow earlier search must not overwrite a newer one's results.
        if (ticket !== seq.current) return
        setResults(found)
        setOpen(true)
      } finally {
        if (ticket === seq.current) setSearching(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query, selected])

  if (selected) {
    return (
      <div className="life-input flex items-center justify-between px-3 py-2 text-sm">
        <span className="text-[color:var(--foreground)]">
          {selected.name}
          <span className="ml-2 text-xs text-[color:var(--muted-foreground)]">{countryName(selected.countryCode)}</span>
        </span>
        <button
          type="button"
          onClick={() => { onClear(); setQuery(''); setResults([]) }}
          className="text-xs text-[color:var(--primary)] hover:underline"
        >
          更改
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="搜索城市，例如 上海 或 Osaka"
        aria-label="搜索城市"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="life-input w-full px-3 py-2 text-sm"
        autoComplete="off"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[color:var(--border)] bg-white shadow-sm"
        >
          {results.length === 0 && !searching && (
            <li className="px-3 py-2 text-xs text-[color:var(--muted-foreground)]">没有找到匹配的城市</li>
          )}
          {results.map(city => (
            <li key={city.id} role="option" aria-selected="false">
              <button
                type="button"
                onClick={() => { onSelect(city); setOpen(false); setResults([]) }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#EEF8F0]"
              >
                <span className="text-[color:var(--foreground)]">{city.name}</span>
                <span className="text-xs text-[color:var(--muted-foreground)]">{countryName(city.countryCode)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
