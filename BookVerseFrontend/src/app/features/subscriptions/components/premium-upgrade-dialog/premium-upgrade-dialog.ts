import {
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-premium-upgrade-dialog',
  standalone: true,
  templateUrl: './premium-upgrade-dialog.html',
  styleUrl: './premium-upgrade-dialog.css',
})
export class PremiumUpgradeDialog {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly dismissed = output<void>();
  readonly isOpeningCheckout = signal(false);
  readonly checkoutError = signal('');
  readonly heading = input('¡Tu próxima lectura te espera!');
  readonly description = input(
    'Con el plan Gratis podés guardar el progreso de hasta 3 historias activas. Si querés registrar el avance de esta historia también, pasate a Premium.',
  );
  readonly secondaryLabel = input('Seguir leyendo sin guardar el progreso');

  open(): void {
    this.checkoutError.set('');
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
    this.dismissed.emit();
  }

  upgradeToPremium(): void {
    if (this.isOpeningCheckout()) return;

    this.isOpeningCheckout.set(true);
    this.checkoutError.set('');

    this.subscriptionService.upgradeToPremium().subscribe({
      next: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
      error: () => {
        this.isOpeningCheckout.set(false);
        this.checkoutError.set(
          'No pudimos iniciar el cambio de plan. Intentá nuevamente.',
        );
      },
    });
  }
}
