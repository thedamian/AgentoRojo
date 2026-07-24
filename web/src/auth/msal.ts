import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
} from "@azure/msal-browser";
import { ADO_SCOPE } from "@agento-rojo/shared";

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID ?? "";
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID?.trim() || "organizations";
const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI?.trim() || "http://localhost:5173";

/** False when VITE_ENTRA_CLIENT_ID is empty/undefined — the app then runs in stub mode. */
export function isEntraConfigured(): boolean {
  return clientId.trim().length > 0;
}

let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<PublicClientApplication> | null = null;

function getMsalInstance(): PublicClientApplication {
  msalInstance ??= new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
    },
  });
  return msalInstance;
}

/** msal-browser v3 requires initialize() (and draining any redirect response) before use. */
async function ensureInitialized(): Promise<PublicClientApplication> {
  const instance = getMsalInstance();
  initPromise ??= instance.initialize().then(async () => {
    await instance.handleRedirectPromise();
    return instance;
  });
  return initPromise;
}

/** The signed-in account, if any. Async because MSAL must finish initializing first. */
export async function getAccount(): Promise<AccountInfo | null> {
  if (!isEntraConfigured()) {
    return null;
  }
  const instance = await ensureInitialized();
  return instance.getAllAccounts()[0] ?? null;
}

export async function signIn(): Promise<void> {
  if (!isEntraConfigured()) {
    return;
  }
  const instance = await ensureInitialized();
  const result = await instance.loginPopup({ scopes: [ADO_SCOPE] });
  instance.setActiveAccount(result.account);
}

export async function signOut(): Promise<void> {
  if (!isEntraConfigured()) {
    return;
  }
  const instance = await ensureInitialized();
  const account = instance.getAllAccounts()[0];
  await instance.logoutPopup(account ? { account } : undefined);
}

/**
 * Acquires an access token for the ADO scope, silently when possible. Returns null in stub
 * mode or when no account is signed in. Pass forceRefresh:true to bypass the token cache
 * (used by the API client after an ADO_UNAUTHORIZED response).
 */
export async function acquireAdoToken(forceRefresh = false): Promise<string | null> {
  if (!isEntraConfigured()) {
    return null;
  }
  const instance = await ensureInitialized();
  const account = instance.getAllAccounts()[0];
  if (!account) {
    return null;
  }
  try {
    const result = await instance.acquireTokenSilent({ scopes: [ADO_SCOPE], account, forceRefresh });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      try {
        const result = await instance.acquireTokenPopup({ scopes: [ADO_SCOPE], account });
        return result.accessToken;
      } catch {
        return null;
      }
    }
    return null;
  }
}
