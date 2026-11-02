export function resolveOnboardingMode({ completed, librarySize }) {
  if (completed) return 'done';
  if (librarySize > 0) return 'existing-library';
  return 'first-run';
}
