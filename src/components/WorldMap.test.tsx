import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import WorldMap from './WorldMap'

// world-atlas numeric ids for the countries used below.
const JAPAN = '392'
const BRAZIL = '76' // stored as 076; the component strips the leading zero
const FRANCE = '250'

function renderMap(props: React.ComponentProps<typeof WorldMap>) {
  return render(<WorldMap {...props} />)
}

describe('WorldMap base geometry', () => {
  it('draws real country outlines from the vector dataset', () => {
    const { container } = renderMap({})
    // Every country path carries a data-name; there should be well over a
    // hundred of them, and Japan among them.
    const named = container.querySelectorAll('path[data-name]')
    expect(named.length).toBeGreaterThan(150)
    expect(container.querySelector('path[data-name="Japan"]')).toBeTruthy()
    // Each drawn shape has a non-empty `d` — proves geometry was projected, not
    // left null.
    for (const p of named) {
      expect(p.getAttribute('d')?.length ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('WorldMap visited-country highlight', () => {
  it('highlights exactly the visited countries and no others', () => {
    const { container } = renderMap({ visitedCountries: ['JPN'] })

    const japan = container.querySelector(`path[data-cc="${JAPAN}"]`)
    const brazil = container.querySelector(`path[data-cc="${BRAZIL}"]`)
    expect(japan).toBeTruthy()
    expect(brazil).toBeTruthy()

    // The whole point: the visited one is marked, the un-visited one is not.
    expect(japan?.getAttribute('data-visited')).toBe('true')
    expect(brazil?.getAttribute('data-visited')).toBe('false')
  })

  it('highlights multiple visited countries at once', () => {
    const { container } = renderMap({ visitedCountries: ['JPN', 'FRA'] })
    expect(container.querySelector(`path[data-cc="${JAPAN}"]`)?.getAttribute('data-visited')).toBe('true')
    expect(container.querySelector(`path[data-cc="${FRANCE}"]`)?.getAttribute('data-visited')).toBe('true')
    expect(container.querySelector(`path[data-cc="${BRAZIL}"]`)?.getAttribute('data-visited')).toBe('false')
  })

  it('highlights nothing when no country is visited', () => {
    const { container } = renderMap({ visitedCountries: [] })
    expect(container.querySelector('path[data-visited="true"]')).toBeNull()
  })
})

describe('WorldMap city points', () => {
  it('plots one marker group per point at a projected coordinate', () => {
    const { container } = renderMap({
      points: [
        { id: 'a', lat: 35.68, lng: 139.69, label: '东京', value: 3 },
        { id: 'b', lat: 48.85, lng: 2.35, label: '巴黎', value: 1 },
      ],
    })
    const markers = container.querySelectorAll('g[data-point-id]')
    expect(markers.length).toBe(2)

    // A projected point lands inside the viewBox, not at the origin or NaN.
    const dot = markers[0].querySelector('circle')
    const cx = Number(dot?.getAttribute('cx'))
    const cy = Number(dot?.getAttribute('cy'))
    expect(Number.isFinite(cx)).toBe(true)
    expect(Number.isFinite(cy)).toBe(true)
    expect(cx).toBeGreaterThan(0)
    expect(cy).toBeGreaterThan(0)
  })

  it('projects with correct orientation (east→right, north→up)', () => {
    // A mirror or vertical flip passes the structural checks above but draws a
    // nonsense map, so pin the orientation down.
    const at = (id: string, lat: number, lng: number) => ({ id, lat, lng, label: id, value: 1 })
    const { container } = renderMap({
      points: [
        at('tokyo', 35.68, 139.69),
        at('sf', 37.77, -122.42),
        at('quito', -0.18, -78.47),
        at('reykjavik', 64.13, -21.9),
      ],
    })
    const xy = (id: string) => {
      const dot = container.querySelector(`g[data-point-id="${id}"] circle`)
      return { x: Number(dot?.getAttribute('cx')), y: Number(dot?.getAttribute('cy')) }
    }
    // Tokyo (east) is right of San Francisco (west).
    expect(xy('tokyo').x).toBeGreaterThan(xy('sf').x)
    // Reykjavík (far north) is above Quito (equator): smaller y = higher up.
    expect(xy('reykjavik').y).toBeLessThan(xy('quito').y)
  })

  it('scales a marker larger with a higher visit count', () => {
    const { container } = renderMap({
      points: [
        { id: 'low', lat: 0, lng: 0, label: 'low', value: 1 },
        { id: 'high', lat: 0, lng: 20, label: 'high', value: 10 },
      ],
    })
    const radius = (id: string) => {
      const g = container.querySelector(`g[data-point-id="${id}"]`)
      // The second circle is the solid dot (first is the halo).
      return Number(g?.querySelectorAll('circle')[1].getAttribute('r'))
    }
    expect(radius('high')).toBeGreaterThan(radius('low'))
  })
})
