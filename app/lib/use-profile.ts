import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

export type Profile = {
  id: string;
  handle: string;
  skill_level: number | null;
  bio: string | null;
  city: string | null;
  search_radius_km: number;
  is_looking_for_match: boolean;
  has_location: boolean;
};

export function useProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, handle, skill_level, bio, city, search_radius_km, is_looking_for_match, home_location')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load profile', error.message);
      setProfile(null);
    } else if (data) {
      const { home_location, ...rest } = data as any;
      setProfile({ ...rest, has_location: home_location != null });
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
