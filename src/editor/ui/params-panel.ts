/**
 * The parameter picker: a small panel listing every parameter of the selected
 * part (or of the part about to be placed) as the control its schema asks for.
 * Plain DOM, rebuilt only when what it shows changes. Buttons never take
 * keyboard focus, so Space and Enter cannot re-fire the last click.
 */
import type { ParamSpec } from '@/grammar/types';
import type { ParamEditor } from '../tools/tool';

export class ParamsPanel {
  private shown = '';

  constructor(private readonly el: HTMLElement) {
    el.hidden = true;
  }

  show(editor: ParamEditor | null): void {
    if (!editor || Object.keys(editor.schema).length === 0) {
      this.shown = '';
      this.el.hidden = true;
      return;
    }
    const stamp = JSON.stringify([editor.title, editor.values]);
    if (stamp === this.shown) return;
    this.shown = stamp;

    const title = document.createElement('div');
    title.className = 'params-title';
    title.textContent = editor.title;
    const rows = Object.entries(editor.schema).map(([key, spec]) => this.row(editor, key, spec));
    this.el.replaceChildren(title, ...rows);
    this.el.hidden = false;
  }

  private row(editor: ParamEditor, key: string, spec: ParamSpec): HTMLElement {
    const row = document.createElement('div');
    row.className = 'params-row';
    const label = document.createElement('span');
    label.className = 'params-label';
    label.textContent = spec.label ?? key.charAt(0).toUpperCase() + key.slice(1);
    const controls = document.createElement('div');
    controls.className = 'params-controls';
    row.append(label, controls);

    const value = editor.values[key];
    const unit = spec.unit ?? '';
    if (spec.kind === 'range') {
      const n = typeof value === 'number' ? value : spec.default;
      const step = (dir: number): void => editor.set(key, n + dir * spec.step);
      const out = document.createElement('span');
      out.className = 'params-value';
      out.textContent = `${n}${unit}`;
      controls.append(
        this.button('−', n <= spec.min, () => step(-1)),
        out,
        this.button('+', n >= spec.max, () => step(1)),
      );
    } else if (spec.kind === 'choice') {
      spec.options.forEach((option, i) => {
        const text = spec.labels?.[i] ?? `${option}${unit}`;
        const b = this.button(text, false, () => editor.set(key, option));
        b.classList.toggle('on', value === option);
        controls.append(b);
      });
    } else {
      const on = value === true;
      const b = this.button(on ? 'On' : 'Off', false, () => editor.set(key, !on));
      b.classList.toggle('on', on);
      controls.append(b);
    }
    return row;
  }

  private button(text: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.disabled = disabled;
    b.tabIndex = -1;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      onClick();
      b.blur();
    });
    return b;
  }
}
