const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: int(process.env.PORT, 3001),
  // Piston API base URL. The public emkc.org instance may require an allow-listed
  // token; see the README for running Piston yourself with docker compose.
  pistonUrl: (process.env.PISTON_URL || 'https://emkc.org/api/v2/piston').replace(/\/+$/, ''),
  pistonToken: process.env.PISTON_TOKEN || '',
  runTimeoutMs: int(process.env.RUN_TIMEOUT_MS, 10_000),
  // Empty rooms are kept in memory this long so people can come back.
  roomTtlMs: int(process.env.ROOM_TTL_MINUTES, 60) * 60_000,
  maxFilesPerRoom: int(process.env.MAX_FILES_PER_ROOM, 30),
  maxUsersPerRoom: int(process.env.MAX_USERS_PER_ROOM, 25),
  maxDocumentLength: int(process.env.MAX_DOCUMENT_LENGTH, 500_000),
  corsOrigin: process.env.CORS_ORIGIN || '',
};
