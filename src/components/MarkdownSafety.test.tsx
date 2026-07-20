import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import MarkdownRenderer from './MarkdownRenderer'

/**
 * A body is Markdown, not a document.
 *
 * These matter because a public article is read by other people: raw HTML in
 * a body would let one author run script in every reader's browser. The
 * renderer escapes its whole input first, so the only HTML in the output is
 * HTML the renderer itself produced.
 */

function dom(md: string) {
  return render(<MarkdownRenderer content={md} />).container
}

const managed = '/api/v1/media/abcdefgh12345678'

describe('raw HTML in a body is not HTML', () => {
  it('does not create a script element', () => {
    expect(dom('<script>window.x=1</script>').querySelector('script')).toBeNull()
  })

  // The dangerous one: script tags added via innerHTML are inert, but an
  // onerror handler runs immediately.
  it('does not create an image with an event handler', () => {
    const container = dom('<img src=x onerror="window.x=1">')
    expect(container.querySelector('img[onerror]')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('does not create an iframe', () => {
    expect(dom('<iframe src="https://evil.example"></iframe>').querySelector('iframe')).toBeNull()
  })

  it('does not create a link with a javascript: target', () => {
    const container = dom('<a href="javascript:window.x=1">click</a>')
    expect(container.querySelector('a')).toBeNull()
  })

  it('does not let an svg carry a handler', () => {
    expect(dom('<svg onload="window.x=1"></svg>').querySelector('svg')).toBeNull()
  })

  it('shows the markup as text instead', () => {
    expect(dom('<b>粗体</b>').textContent).toContain('<b>粗体</b>')
  })

  it('does not let a crafted image source add an attribute', () => {
    const container = dom(`![x](${managed}" onerror="window.x=1)`)
    expect(container.querySelector('[onerror]')).toBeNull()
  })

  it('does not let a wiki link target break out', () => {
    const container = render(
      <MarkdownRenderer
        content={'[[x]]'}
        resolveLink={() => ({ href: '/a" onmouseover="window.x=1', label: 'x' })}
      />
    ).container
    expect(container.querySelector('[onmouseover]')).toBeNull()
  })
})

describe('video is a directive, not markup', () => {
  it('renders @[video](url) as a video element', () => {
    const video = dom(`@[video](${managed})`).querySelector('video')!
    expect(video).not.toBeNull()
    expect(video.getAttribute('src')).toBe(managed)
    // Shows a still without fetching the video itself.
    expect(video.getAttribute('poster')).toBe(`${managed}?variant=thumb`)
    expect(video.getAttribute('preload')).toBe('metadata')
  })

  it('gives an external video no poster to ask for', () => {
    const video = dom('@[video](https://example.com/a.mp4)').querySelector('video')!
    expect(video.getAttribute('poster')).toBeNull()
  })

  it('cannot be used to inject attributes', () => {
    const container = dom('@[video](x" onerror="window.x=1)')
    expect(container.querySelector('[onerror]')).toBeNull()
  })
})

describe('link and media schemes are allowlisted', () => {
  // Escaping the body does not help here: the anchor is HTML the renderer
  // builds itself.
  it('does not make a javascript: link clickable', () => {
    const container = dom('[点我](javascript:alert(1))')
    expect(container.querySelector('a')).toBeNull()
    // The address stays readable — removing it would hide what the author wrote.
    expect(container.textContent).toContain('javascript:alert(1)')
  })

  it('does not make a data: link clickable', () => {
    expect(dom('[x](data:text/html,<script>alert(1)</script>)').querySelector('a')).toBeNull()
  })

  it('refuses a scheme hidden behind a control character', () => {
    expect(dom('[x](java\tscript:alert(1))').querySelector('a')).toBeNull()
  })

  it('still links https and internal routes', () => {
    expect(dom('[x](https://example.com)').querySelector('a')?.getAttribute('href'))
      .toBe('https://example.com')
    expect(dom('[x](/euan/pkm/note)').querySelector('a')?.getAttribute('href'))
      .toBe('/euan/pkm/note')
  })

  it('does not render a javascript: image', () => {
    const container = dom('![x](javascript:alert(1))')
    expect(container.querySelector('img')).toBeNull()
  })

  it('does not render a data: image', () => {
    expect(dom('![x](data:text/html,<script>alert(1)</script>)').querySelector('img')).toBeNull()
  })

  it('does not render a javascript: video', () => {
    expect(dom('@[video](javascript:alert(1))').querySelector('video')).toBeNull()
  })

  it('does not render a protocol-relative image', () => {
    expect(dom('![x](//evil.example/a.png)').querySelector('img')).toBeNull()
  })

  it('refuses a hostile wiki link target', () => {
    const container = render(
      <MarkdownRenderer content={'[[x]]'} resolveLink={() => ({ href: 'javascript:alert(1)', label: 'x' })} />
    ).container
    expect(container.querySelector('a')).toBeNull()
    // Still shown, just not clickable.
    expect(container.querySelector('.wikilink')).not.toBeNull()
  })
})

describe('ordinary markdown still works', () => {
  it('renders emphasis and headings', () => {
    const container = dom('# 标题\n\n正文有**重点**。')
    expect(container.querySelector('h1')?.textContent).toBe('标题')
    expect(container.querySelector('strong')?.textContent).toBe('重点')
  })

  it('renders code without executing it', () => {
    const container = dom('`<script>alert(1)</script>`')
    expect(container.querySelector('code')?.textContent).toBe('<script>alert(1)</script>')
    expect(container.querySelector('script')).toBeNull()
  })
})
