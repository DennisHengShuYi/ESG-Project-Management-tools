import { supabase } from '../supabase.js';

export const checkEventOwnership = async (eventId, organisationId) => {
  const { data, error } = await supabase
    .from('events')
    .select('organisation_id')
    .eq('id', eventId)
    .maybeSingle();
  if (error || !data) return false;
  return data.organisation_id === organisationId;
};
