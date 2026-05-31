import { defineStore } from "pinia";
import { ref } from "vue";
import { clearAuthToken, getAuthToken, getCurrentUser, login, type AuthUser } from "../api/auth";
import { localizeError } from "../i18n/errors";
import { useLocaleStore } from "./locale";

export const useAuthStore = defineStore("auth", () => {
  const localeStore = useLocaleStore();
  const user = ref<AuthUser | null>(null);
  const error = ref<string | null>(null);
  const restoring = ref(false);
  const tokenAvailable = ref(Boolean(getAuthToken()));
  let authRequestId = 0;

  async function loginDemo(): Promise<void> {
    await loginWithCredentials("demo@hiveton.dev", "password");
  }

  async function loginWithCredentials(email: string, password: string): Promise<void> {
    const requestId = ++authRequestId;
    error.value = null;
    restoring.value = false;
    try {
      const response = await login(email, password);
      if (requestId !== authRequestId) {
        return;
      }
      user.value = response.user;
      tokenAvailable.value = true;
    } catch (caught) {
      if (requestId !== authRequestId) {
        return;
      }
      tokenAvailable.value = Boolean(getAuthToken());
      error.value = localizeError(caught, localeStore.locale, "LOGIN_FAILED");
    }
  }

  async function restoreSession(): Promise<void> {
    if (!getAuthToken() || user.value || restoring.value) {
      return;
    }
    const requestId = ++authRequestId;
    restoring.value = true;
    error.value = null;
    try {
      const restoredUser = await getCurrentUser();
      if (requestId !== authRequestId || !getAuthToken()) {
        tokenAvailable.value = Boolean(getAuthToken());
        return;
      }
      user.value = restoredUser;
      tokenAvailable.value = true;
    } catch (caught) {
      if (requestId !== authRequestId) {
        return;
      }
      user.value = null;
      tokenAvailable.value = Boolean(getAuthToken());
      error.value = localizeError(caught, localeStore.locale, "CURRENT_USER_LOOKUP_FAILED");
    } finally {
      if (requestId === authRequestId) {
        restoring.value = false;
      }
    }
  }

  function logout(): void {
    authRequestId += 1;
    clearAuthToken();
    user.value = null;
    error.value = null;
    restoring.value = false;
    tokenAvailable.value = false;
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    user,
    error,
    restoring,
    tokenAvailable,
    clearError,
    loginDemo,
    loginWithCredentials,
    restoreSession,
    logout
  };
});
