import type { AgentWallet, WalletIdentity, WalletPayment } from '../shared/types';
import { storage } from './storage';

// The Agent Wallet: the user's purchase profile for the agentic ticket
// checkout. Entered once, stored ONLY on this device — in the keychain via
// expo-secure-store on iOS/Android, localStorage on web (dev). Split into the
// identity a checkout asks for (name/email/address/DOB) and the payment
// method. Sent to the server per request; never persisted server-side.
//
// ⚠️ PROTOTYPE: storing raw card data — even in a secure store — is a demo
// shortcut. A production version must tokenize cards with a payment provider.

const WALLET_KEY = 'iykyk_agent_wallet';

export const EMPTY_WALLET: AgentWallet = {
  name: '',
  email: '',
  address: '',
  dateOfBirth: '',
  cardNumber: '',
  cardExpiry: '',
  cardCvc: '',
};

export async function loadWallet(): Promise<AgentWallet> {
  try {
    const raw = await storage.getItemAsync(WALLET_KEY);
    if (!raw) return { ...EMPTY_WALLET };
    const parsed = JSON.parse(raw) as Partial<AgentWallet>;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_WALLET };
    return { ...EMPTY_WALLET, ...parsed };
  } catch {
    return { ...EMPTY_WALLET };
  }
}

export async function saveWallet(wallet: AgentWallet): Promise<void> {
  await storage.setItemAsync(WALLET_KEY, JSON.stringify(wallet));
}

export async function clearWallet(): Promise<void> {
  await storage.deleteItemAsync(WALLET_KEY);
}

export function identityOf(w: AgentWallet): WalletIdentity {
  return { name: w.name, email: w.email, address: w.address, dateOfBirth: w.dateOfBirth };
}

export function paymentOf(w: AgentWallet): WalletPayment {
  return { cardNumber: w.cardNumber, cardExpiry: w.cardExpiry, cardCvc: w.cardCvc };
}

// "•••• 4242" for display.
export function maskedCard(wallet: AgentWallet | null): string {
  const digits = wallet?.cardNumber.replace(/\D/g, '') ?? '';
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '';
}

// A YYYY-MM-DD string that is a real calendar date.
function isValidDob(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return false;
  const d = new Date(`${v.trim()}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d < new Date();
}

// Step 1 completeness: the identity a checkout needs.
export function identityComplete(w: AgentWallet): boolean {
  return (
    w.name.trim().length > 0 &&
    /.+@.+\..+/.test(w.email.trim()) &&
    w.address.trim().length > 0 &&
    isValidDob(w.dateOfBirth)
  );
}

// Step 3 completeness: a usable payment method.
export function paymentComplete(w: AgentWallet): boolean {
  return (
    w.cardNumber.replace(/\D/g, '').length >= 12 &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(w.cardExpiry.trim()) &&
    /^\d{3,4}$/.test(w.cardCvc.trim())
  );
}

export function walletComplete(w: AgentWallet): boolean {
  return identityComplete(w) && paymentComplete(w);
}
