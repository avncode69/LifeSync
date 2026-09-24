// Google Workspace & OAuth 2.0 Client Service

declare global {
  interface Window {
    google?: any;
  }
}

export const GoogleService = {
  getClientId(): string {
    return (
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem('lifesync_google_client_id') ||
      ''
    );
  },

  setClientId(clientId: string): void {
    localStorage.setItem('lifesync_google_client_id', clientId.trim());
  },

  async promptGoogleSignIn(): Promise<{ name: string; email: string; avatar?: string } | null> {
    const clientId = this.getClientId();

    if (!clientId) {
      // Якщо Client ID ще не заданий користувачем у налаштуваннях або .env,
      // запитуємо ім'я та email користувача для входу через Google профіль
      const email = prompt('Введіть ваш Google Email:', 'alex.kovalenko@gmail.com');
      if (!email) return null;
      const name = prompt("Введіть ваше ім'я:", 'Олександр Коваленко') || 'Користувач Google';
      return { name, email, avatar: undefined };
    }

    // Google Identity Services (GIS) Web OAuth 2.0
    return new Promise((resolve) => {
      // Load Google script if not yet loaded
      if (!window.google) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          this.initGisTokenClient(clientId, resolve);
        };
        script.onerror = () => {
          resolve(null);
        };
        document.body.appendChild(script);
      } else {
        this.initGisTokenClient(clientId, resolve);
      }
    });
  },

  initGisTokenClient(clientId: string, callback: (val: any) => void) {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly',
        callback: async (response: any) => {
          if (response.error) {
            callback(null);
            return;
          }
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            const profile = await userInfoRes.json();
            callback({
              name: profile.name || profile.given_name || 'Google User',
              email: profile.email,
              avatar: profile.picture,
            });
          } catch {
            callback(null);
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      console.warn('GIS error', e);
      callback(null);
    }
  },
};
