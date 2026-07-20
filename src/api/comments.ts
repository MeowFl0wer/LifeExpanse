import { ok, fail } from './client'
import { usingBackend } from './http'
import { request } from './http'
import { articleComments, allContent, nextId } from '../mockData'
import type { ArticleComment } from '../types'

/**
 * Article comments.
 *
 * Same shape as the rest of the data layer: dispatch on `usingBackend()` so
 * pages call one set of names. The rules (需求 11) are the server's to enforce
 * — only signed-in users may post, only where the author switched comments on,
 * and a commenter may remove their own while the content author may remove any
 * on their own content. The in-memory branch mirrors them so the prototype
 * behaves the same, but it is not the authority.
 */

interface WireComment {
  id: string
  content_id: string
  author: string
  author_display_name: string
  body: string
  created_at: string
}

function fromWire(w: WireComment): ArticleComment {
  return {
    id: w.id,
    contentId: w.content_id,
    author: w.author,
    authorDisplayName: w.author_display_name,
    body: w.body,
    createdAt: w.created_at,
  }
}

export async function listComments(contentId: string): Promise<ArticleComment[]> {
  if (usingBackend()) {
    const rows = await request<WireComment[]>(`/content/${contentId}/comments`)
    return rows.map(fromWire)
  }
  return ok(
    articleComments
      .filter(c => c.contentId === contentId && !c.hidden)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  )
}

export async function addComment(
  contentId: string,
  actor: string,
  body: string
): Promise<ArticleComment> {
  const text = body.trim()
  if (!text) return fail('请先写下评论内容', 400)

  if (usingBackend()) {
    const row = await request<WireComment>(`/content/${contentId}/comments`, {
      method: 'POST',
      body: { body: text },
    })
    return fromWire(row)
  }

  const item = allContent.find(c => c.id === contentId)
  // Mirrors the backend rule: the current form decides, not the flag alone, so
  // an article reverted to a note stops accepting comments.
  if (!item || item.type !== 'pkm' || item.contentKind !== 'article' || !item.allowComments) {
    return fail('这篇内容没有开启评论', 403)
  }

  const comment: ArticleComment = {
    id: nextId('cm'),
    contentId,
    author: actor,
    authorDisplayName: actor === 'euan' ? 'Euan' : actor,
    body: text,
    createdAt: new Date().toISOString(),
  }
  articleComments.push(comment)
  return ok(comment)
}

export async function removeComment(
  contentId: string,
  commentId: string,
  actor: string
): Promise<void> {
  if (usingBackend()) {
    await request<void>(`/content/${contentId}/comments/${commentId}`, { method: 'DELETE' })
    return
  }

  const index = articleComments.findIndex(c => c.id === commentId && c.contentId === contentId)
  if (index === -1) return fail('评论不存在', 404)
  const comment = articleComments[index]!
  const item = allContent.find(c => c.id === contentId)
  const isOwnComment = comment.author === actor
  const isContentAuthor = item?.author === actor
  // Same 404 either way: a stranger should not learn the comment exists.
  if (!isOwnComment && !isContentAuthor) return fail('评论不存在', 404)
  articleComments.splice(index, 1)
  return ok(undefined)
}
