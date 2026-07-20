import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import MarkdownRenderer from './MarkdownRenderer'

const managed = '/api/v1/media/abcdefgh12345678'

function html(md: string): string {
  const { container } = render(<MarkdownRenderer content={md} />)
  return container.innerHTML
}

describe('images in rendered content', () => {
  // The whole point: displaying a page must not pull full-size files.
  it('displays the thumbnail, not the original', () => {
    const out = html(`![照片](${managed})`)
    expect(out).toContain(`src="${managed}?variant=thumb"`)
    expect(out).not.toContain(`<img src="${managed}"`)
  })

  it('offers 查看原图 pointing at the original', () => {
    const { container } = render(<MarkdownRenderer content={`![照片](${managed})`} />)
    const link = container.querySelector('a[target="_blank"]')!
    expect(link.getAttribute('href')).toBe(managed)
    expect(link.textContent).toBe('查看原图')
  })

  it('offers a download link', () => {
    const { container } = render(<MarkdownRenderer content={`![照片](${managed})`} />)
    const link = container.querySelector('a[download]')!
    expect(link.getAttribute('href')).toBe(`${managed}?download=true`)
    expect(link.textContent).toBe('下载')
  })

  it('opens the original safely in a new tab', () => {
    const { container } = render(<MarkdownRenderer content={`![照片](${managed})`} />)
    // Without noopener the opened page can reach back through window.opener.
    expect(container.querySelector('a[target="_blank"]')!.getAttribute('rel'))
      .toBe('noopener noreferrer')
  })

  it('loads images lazily', () => {
    expect(html(`![照片](${managed})`)).toContain('loading="lazy"')
  })

  // An external image has no thumbnail, and a download button for someone
  // else's host would be misleading.
  it('leaves an external image plain', () => {
    const out = html('![外链](https://example.com/photo.png)')
    expect(out).toContain('src="https://example.com/photo.png"')
    expect(out).not.toContain('life-figure')
    expect(out).not.toContain('下载')
  })

  // Asserting on serialised HTML would be misleading here: the HTML spec does
  // not re-escape `<` inside an attribute value, so `innerHTML` shows the raw
  // characters even when the value is a harmless string. What matters is the
  // parsed DOM — no element was created.
  it('does not let alt text become markup', () => {
    const { container } = render(
      <MarkdownRenderer content={`![<script>alert(1)</script>](${managed})`} />
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')!.getAttribute('alt'))
      .toBe('<script>alert(1)</script>')
  })

  it('does not let a crafted src break out of the attribute', () => {
    const { container } = render(
      <MarkdownRenderer content={'![x](https://e.com/a.png" onerror="alert(1))'} />
    )
    const img = container.querySelector('img')!
    expect(img.getAttribute('onerror')).toBeNull()
  })

  it('keeps the figure out of a paragraph wrapper', () => {
    const { container } = render(<MarkdownRenderer content={`![照片](${managed})`} />)
    // A <span> inside <p> is valid, but the block detector used to wrap it —
    // which nested the actions oddly. The figure should be top level.
    expect(container.querySelector('.life-figure')?.parentElement?.tagName).not.toBe('P')
  })
})
