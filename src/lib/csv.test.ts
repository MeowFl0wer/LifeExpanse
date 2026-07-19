import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('splits a plain row', () => {
    expect(parseCsv('2024-12-01,CA,CA981,PEK,NRT,2096,215,正常')).toEqual([
      ['2024-12-01', 'CA', 'CA981', 'PEK', 'NRT', '2096', '215', '正常'],
    ])
  })

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('2024-12-01,"Air China, Ltd",CA981')).toEqual([
      ['2024-12-01', 'Air China, Ltd', 'CA981'],
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('a,"He said ""hi""",c')).toEqual([['a', 'He said "hi"', 'c']])
  })

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([['a', 'line1\nline2', 'c']])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('drops blank rows', () => {
    expect(parseCsv('a,b\n\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('keeps a header row for the caller to decide on', () => {
    expect(parseCsv('日期,航空公司\n2024-12-01,CA')).toEqual([
      ['日期', '航空公司'],
      ['2024-12-01', 'CA'],
    ])
  })

  it('trims unquoted fields but preserves spacing inside quotes', () => {
    expect(parseCsv('  a  , " b " ')).toEqual([['a', ' b ']])
  })

  it('preserves empty fields between separators', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
  })

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('\n\n')).toEqual([])
  })

  it('handles a trailing newline without emitting an extra row', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']])
  })
})
