import { defineStore } from "pinia";
import { ref } from "vue";
import { clearAuthToken, getAuthToken, getCurrentUser, login, type AuthUser } from "../api/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const error = ref<string | null>(null);
  const restoring = ref(false);

  async function loginDemo(): Promise<void> {
    await loginWithCredentials("demo@hiveton.dev", "password");
  }

  async function loginWithCredentials(email: string, password: string): Promise<void> {
    error.value = null;
    try {
      const response = await login(email, password);
      user.value = response.user;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : "login failed";
    }
  }

  async function restoreSession(): Promise<void> {
    if (!getAuthToken() || user.value || restoring.value) {
      return;
    }
    restoring.value = true;
    error.value = null;
    try {
      user.value = await getCurrentUser();
    } catch (caught) {
      user.value = null;
      error.value = caught instanceof Error ? caught.message : "session restore failed";
    } finally {
      restoring.value = false;
    }
  }

  function logout(): void {
    clearAuthToken();
    user.value = null;
    error.value = null;
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    user,
    error,
    restoring,
    clearError,
    loginDemo,
    loginWithCredentials,
    restoreSession,
    logout
  };
});
