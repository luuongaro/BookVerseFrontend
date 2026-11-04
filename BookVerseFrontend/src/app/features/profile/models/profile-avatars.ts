export const PROFILE_AVATARS = [
  { src: '/assets/avatars/magic.png', name: 'Magia' },
  { src: '/assets/avatars/fantasy.png', name: 'Fantasía' },
  { src: '/assets/avatars/romance.png', name: 'Romance' },
  { src: '/assets/avatars/adventure.png', name: 'Aventura' },
  { src: '/assets/avatars/reader.png', name: 'Lectura' },
  { src: '/assets/avatars/mystery.png', name: 'Misterio' },
] as const;

export function profileAvatar(index: unknown) {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null;
  const avatar = PROFILE_AVATARS[index];
  return typeof avatar?.src === 'string' && avatar.src.trim() ? avatar : null;
}
