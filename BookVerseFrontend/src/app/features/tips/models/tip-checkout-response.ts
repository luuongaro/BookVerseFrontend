import { TipResponse } from './tip-response';

export interface MercadoPagoCheckoutResponse {
  preferenceId: string;
  checkoutUrl: string;
}

export interface TipCheckoutResponse {
  tip: TipResponse;
  checkout: MercadoPagoCheckoutResponse;
}