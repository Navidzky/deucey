import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

// Lets the in-app browser close itself once Google redirects back to us (web only;
// no-op on native, but required there per expo-web-browser's docs).
WebBrowser.maybeCompleteAuthSession();

const nativeRedirectTo = makeRedirectUri();

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

/**
 * Starts "Sign in with Google". On web this redirects the whole page to Google
 * and back (supabase-js picks up the session automatically on return). On
 * native it opens an in-app browser and manually turns the redirect URL into a
 * session, since there's no address bar for supabase-js to read from.
 */
export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) throw error;
    return; // browser is navigating away now
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: nativeRedirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Supabase did not return a Google sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, nativeRedirectTo);
  if (result.type === 'success' && result.url) {
    await createSessionFromUrl(result.url);
  }
  // 'cancel' / 'dismiss' just means the user backed out — nothing to do.
}
