import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import CitySearchInput from './CitySearchInput'
import type { FootprintCityResult } from '../types'

// A tiny host that holds the selection, the way the form does.
function Host({ onPick }: { onPick?: (c: FootprintCityResult) => void }) {
  const [selected, setSelected] = useState<FootprintCityResult | null>(null)
  return (
    <CitySearchInput
      selected={selected}
      onSelect={c => { setSelected(c); onPick?.(c) }}
      onClear={() => setSelected(null)}
    />
  )
}

describe('CitySearchInput', () => {
  it('resolves a Chinese query to the dataset city and reports the full result', async () => {
    const onPick = vi.fn()
    render(<Host onPick={onPick} />)

    await userEvent.type(screen.getByRole('combobox'), '上海')
    const option = await screen.findByRole('button', { name: /Shanghai/ })
    await userEvent.click(option)

    // The selected result carries country + coordinate, not just the typed text.
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0][0]).toMatchObject({ name: 'Shanghai', countryCode: 'CHN' })
  })

  it('shows the chosen city and lets the user change it', async () => {
    render(<Host />)
    await userEvent.type(screen.getByRole('combobox'), 'Osak')
    await userEvent.click(await screen.findByRole('button', { name: /Osaka/ }))

    // Now in the selected state: the input is gone, a change affordance appears.
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Osaka')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: '更改' }))
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('tells the user when nothing matches', async () => {
    render(<Host />)
    await userEvent.type(screen.getByRole('combobox'), 'zzzznotacity')
    await waitFor(() => expect(screen.getByText('没有找到匹配的城市')).toBeTruthy())
  })
})
