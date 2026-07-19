import { describe, it, expect } from 'vitest'
import {
  parseWikiLinks, resolveWikiLink, unresolvedLinks, backlinksTo, outgoingLinks,
} from './wikilink'

const items = [
  { slug: 'react-notes', title: 'React 并发模式', body: '正文，见 [[ssh-config]]' },
  { slug: 'ssh-config', title: 'SSH 配置备忘', body: '正文，参考 [[React 并发模式]]' },
  { slug: 'lonely', title: '孤立笔记', body: '没有链接' },
]

describe('parseWikiLinks', () => {
  it('finds a plain link', () => {
    expect(parseWikiLinks('见 [[react-notes]]')).toEqual([
      { raw: '[[react-notes]]', target: 'react-notes', display: 'react-notes' },
    ])
  })

  it('supports a display alias', () => {
    expect(parseWikiLinks('见 [[react-notes|并发笔记]]')).toEqual([
      { raw: '[[react-notes|并发笔记]]', target: 'react-notes', display: '并发笔记' },
    ])
  })

  it('finds several links in one document', () => {
    expect(parseWikiLinks('[[a]] 和 [[b]]').map(l => l.target)).toEqual(['a', 'b'])
  })

  it('ignores empty and malformed links', () => {
    expect(parseWikiLinks('[[]] [[   ]] [not a link] [[unclosed')).toEqual([])
  })

  it('falls back to the target when the alias is blank', () => {
    expect(parseWikiLinks('[[a|]]')[0]!.display).toBe('a')
  })
})

describe('resolveWikiLink', () => {
  it('matches a slug', () => {
    expect(resolveWikiLink('react-notes', items)?.slug).toBe('react-notes')
  })

  it('matches a title', () => {
    expect(resolveWikiLink('React 并发模式', items)?.slug).toBe('react-notes')
  })

  it('is case-insensitive', () => {
    expect(resolveWikiLink('REACT-NOTES', items)?.slug).toBe('react-notes')
  })

  it('returns nothing for an unknown target', () => {
    expect(resolveWikiLink('不存在', items)).toBeUndefined()
  })
})

describe('unresolvedLinks', () => {
  it('reports targets with no matching note', () => {
    expect(unresolvedLinks('[[ssh-config]] 与 [[还没写的笔记]]', items)).toEqual(['还没写的笔记'])
  })

  it('de-duplicates', () => {
    expect(unresolvedLinks('[[x]] [[x]]', items)).toEqual(['x'])
  })
})

describe('backlinksTo', () => {
  it('finds notes linking by slug', () => {
    const target = items[1]!
    expect(backlinksTo(target, items).map(i => i.slug)).toEqual(['react-notes'])
  })

  it('finds notes linking by title', () => {
    const target = items[0]!
    expect(backlinksTo(target, items).map(i => i.slug)).toEqual(['ssh-config'])
  })

  it('excludes the note itself', () => {
    const selfRef = { slug: 'self', title: '自引用', body: '看 [[self]]' }
    expect(backlinksTo(selfRef, [selfRef])).toEqual([])
  })

  it('returns nothing when no one links in', () => {
    expect(backlinksTo(items[2]!, items)).toEqual([])
  })
})

describe('outgoingLinks', () => {
  it('resolves links out of a document', () => {
    expect(outgoingLinks('见 [[ssh-config]] 和 [[React 并发模式]]', items).map(i => i.slug))
      .toEqual(['ssh-config', 'react-notes'])
  })

  it('skips unresolved targets', () => {
    expect(outgoingLinks('[[不存在]]', items)).toEqual([])
  })

  it('de-duplicates repeated links', () => {
    expect(outgoingLinks('[[ssh-config]] [[SSH 配置备忘]]', items)).toHaveLength(1)
  })
})
