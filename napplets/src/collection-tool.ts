// SPDX-License-Identifier: MIT
import { tool, field, button, rows } from './workspace-ui';
import { el } from './ui';
/** Common CRUD presentation; authorization and persistence are always host-side. */
export function collection(kind: 'chapter' | 'event' | 'task', title: string, intro: string, slug: string) {
  const { panel, service, status, run } = tool(title, intro, slug);
  const name = field(panel, 'Title');
  const location = kind === 'chapter' ? field(panel, 'Place or city') : null;
  const chapter = kind === 'event' ? field(panel, 'Chapter ID (optional)') : null;
  const starts = kind === 'event' ? field(panel, 'Starts at', 'datetime-local') : null;
  const list = el('div');
  const refresh = async () => {
    rows(list, await service!.read(), (row, card) => {
      const detail = kind === 'event' ? new Date(String(row.startsAt)).toLocaleString() : String(row.location ?? row.state);
      card.append(el('h2', String(row.title)), el('p', detail));
      if (kind === 'chapter') { const reference = el('small', `Chapter ID: ${row.id}`); reference.style.display = 'block'; card.append(reference); }
      if (kind === 'task' && row.state === 'open') button(card, 'Mark done', true, () => void run(async () => {
        await service!.command({ requestId: crypto.randomUUID(), action: 'task.complete', input: { id: row.id, revision: row.revision } }); await refresh(); return 'Task completed.';
      }));
    });
  };
  button(panel, 'Save', !!service, () => void run(async () => {
    const input: Record<string, unknown> = { title: name.value };
    if (location) input.location = location.value;
    if (starts && chapter) { input.chapterId = chapter.value; input.startsAt = new Date(starts.value).toISOString(); }
    await service!.command({ requestId: crypto.randomUUID(), action: `${kind}.create`, input });
    name.value = ''; await refresh(); return 'Saved.';
  }));
  panel.append(list);
  if (service) void refresh().then(() => { status.textContent = 'Loaded from the guild host.'; }).catch(error => { status.textContent = error.message; });
}
