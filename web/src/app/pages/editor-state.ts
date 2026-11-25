import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, type Observable } from 'rxjs';
import { message } from '../api/ledger';

export class EditorState {
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly editing = signal<number|null>(null);
  readonly open = signal(false);
  begin(id:number|null) {
    this.editing.set(id);
    this.open.set(true);
    this.error.set('');
    this.notice.set('');
  }
  close() { this.open.set(false); this.editing.set(null); }
  run<T>(request:Observable<T>, accept:(value:T)=>void) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    request.pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({
      next:accept,error:(error:unknown)=>this.error.set(message(error))
    });
  }
}
export function put<T extends {id:number;name:string}>(rows:T[],item:T):T[] {
  return [...rows.filter(row=>row.id!==item.id),item].sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
}
