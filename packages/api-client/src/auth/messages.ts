// Map a Supabase auth error to a Danish, user-facing message (adapted from the 2.1
// production AuthProvider). Pure + unit-tested so the wording is verified without a
// live GoTrue.
export function loginErrorMessage(raw: string): string {
  if (raw.includes('Invalid login credentials')) return 'Forkert e-mail eller adgangskode.';
  if (raw.includes('Email not confirmed')) return 'Din e-mail er ikke bekræftet. Tjek din indbakke.';
  if (raw.includes('network') || raw.includes('Failed to fetch')) return 'Kunne ikke nå serveren. Tjek din forbindelse.';
  return raw;
}
