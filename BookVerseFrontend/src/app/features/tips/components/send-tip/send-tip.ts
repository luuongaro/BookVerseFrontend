import {
  Component,
  DestroyRef,
  InjectionToken,
  Input,
  OnChanges,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TipService } from '../../services/tip.service';

export const CHECKOUT_REDIRECT = new InjectionToken<(url: string) => void>('CHECKOUT_REDIRECT', {
  providedIn: 'root',
  factory: () => (url) => window.location.assign(url),
});

@Component({
  selector: 'app-send-tip',
  template: `<button
      type="button"
      class="tip-button"
      [disabled]="pending() || !storyId"
      (click)="send()"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path
          d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm12 1h2a3 3 0 0 1 0 6h-2M8 3v2m4-2v2M2 23h18"
        />
      </svg>
      {{ pending() ? 'Preparando cafecito…' : 'Enviar cafecito · $1.000' }}
    </button>
    @if (error()) {
      <p class="tip-error" role="alert">{{ error() }}</p>
    }`,
  styles: `
    :host {
      display: block;
    }
    .tip-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      min-height: 42px;
      padding: 10px 16px;
      border: 1px solid #e5d2bc;
      border-radius: 10px;
      background: #fbf1e4;
      color: #795a3d;
      font:
        13px 'DM Sans',
        Arial,
        sans-serif;
      cursor: pointer;
    }
    .tip-button:hover:not(:disabled) {
      background: #f6e7d3;
    }
    .tip-button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .tip-button:focus-visible {
      outline: 2px solid #7465ad;
      outline-offset: 3px;
    }
    svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .tip-error {
      max-width: 320px;
      color: #a44d68;
      font-size: 12px;
      line-height: 1.5;
      margin: 8px 0 0;
    }
  `,
})
export class SendTip implements OnChanges {
  private readonly tips = inject(TipService);
  private readonly redirect = inject(CHECKOUT_REDIRECT);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  @Input({ required: true }) storyId = '';
  @Input() recipientName = '';
  readonly pending = signal(false);
  readonly error = signal('');

  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.pending.set(false);
    this.error.set('');
  }

  send(): void {
    if (!this.storyId || this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    this.request = this.tips
      .createTip({
        storyId: this.storyId,
        amount: 1000,
        message: this.recipientName
          ? `Cafecito para ${this.recipientName}`
          : 'Cafecito para esta historia',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.pending.set(false);
          try {
            const url = new URL(result.checkout.checkoutUrl);
            if (url.protocol !== 'https:') throw new Error('Invalid checkout');
            this.redirect(url.href);
          } catch {
            this.error.set('No pudimos abrir el pago del cafecito. Intentá de nuevo.');
          }
        },
        error: () => {
          this.pending.set(false);
          this.error.set('No pudimos preparar el cafecito. Intentá de nuevo más tarde.');
        },
      });
  }
}
