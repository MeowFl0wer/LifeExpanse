import { backupJobs } from '../mockData'

/**
 * Site-level backup and restore.
 *
 * Still the original prototype: the buttons describe what would happen rather
 * than doing it. Kept as-is while the console around it became real, so the
 * plan for backups is not lost — it needs a backend of its own (snapshotting
 * the database and the media directory, then verifying the archive).
 *
 * Distinct from the per-user export under 「我的」, which covers one account's
 * own data. This one covers the whole site.
 */

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      {desc && <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">{desc}</p>}
    </div>
  )
}

export default function AdminBackupPanel() {
  return (
    <div className="space-y-10">
      <section>
        <SectionTitle title="系统备份" desc="备份包含数据库、媒体文件、系统配置和校验值。" />
        <p className="mb-4 rounded-[var(--radius)] bg-[color:var(--secondary)] px-3 py-2.5 text-xs leading-6 text-[color:var(--muted-foreground)]">
          这一块仍是原型：按钮只描述将要发生什么，不会真的执行。需要单独的后端支持。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => alert('前端原型：将创建一份完整系统备份并生成校验值。')}
            className="life-button life-button-primary text-sm"
          >
            立即备份
          </button>
          <button
            type="button"
            onClick={() => alert('前端原型：自动备份计划配置。')}
            className="life-button text-sm"
          >
            自动备份设置
          </button>
        </div>
        <div className="mt-6 border-t border-[color:var(--border)]">
          {backupJobs.map(b => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-4">
              <div>
                <p className="text-sm text-[color:var(--foreground)]">{b.createdAt}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                  {b.kind}备份 · {b.sizeMb} MB
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-[#D5EBD9] bg-[#EEF8F0] px-2.5 py-0.5 text-xs text-[#3F744D]">
                  {b.status}
                </span>
                <button
                  type="button"
                  onClick={() => alert('前端原型：下载备份包。')}
                  className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                >
                  下载
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--border)] pt-8">
        <SectionTitle
          title="系统恢复"
          desc="完整恢复会进入维护模式并停止写入，恢复前自动创建快照。与用户级的合并导入不同，这是覆盖式恢复。"
        />
        <button
          type="button"
          onClick={() => {
            if (window.confirm('系统恢复会覆盖当前全部数据。\n\n流程：校验备份 → 进入维护模式 → 创建恢复前快照 → 执行恢复 → 完整性检查。\n\n确定继续吗？')) {
              alert('前端原型：真实恢复需要后端支持。')
            }
          }}
          className="life-button text-sm text-[#B23B3B] hover:border-[#B23B3B] hover:text-[#B23B3B]"
        >
          从备份恢复
        </button>
      </section>
    </div>
  )
}
