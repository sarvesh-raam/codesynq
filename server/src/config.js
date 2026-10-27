const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: int(process.env.PORT, 3001),
  // 'wandbox' uses the free public Wandbox API; 'piston' uses a self-hosted
  // Piston (see docker-compose.yml). Setting PISTON_URL selects Piston.
  executor: process.env.EXECUTOR || (process.env.PISTON_URL ? 'piston' : 'wandbox'),
  pistonUrl: (process.env.PISTON_URL || 'http://localhost:2000/api/v2').replace(/\/+$/, ''),
  pistonToken: process.env.PISTON_TOKEN || '',
  runTimeoutMs: int(process.env.RUN_TIMEOUT_MS, 10_000),
  wandboxUrl: (process.env.WANDBOX_URL || 'https://wandbox.org/api').replace(/\/+$/, ''),
  // Wandbox is shared and can take tens of seconds to compile.
  wandboxTimeoutMs: int(process.env.WANDBOX_TIMEOUT_MS, 60_000),
  // Empty rooms are kept in memory this long so people can come back.
  roomTtlMs: int(process.env.ROOM_TTL_MINUTES, 60) * 60_000,
  maxFilesPerRoom: int(process.env.MAX_FILES_PER_ROOM, 30),
  maxUsersPerRoom: int(process.env.MAX_USERS_PER_ROOM, 25),
  maxDocumentLength: int(process.env.MAX_DOCUMENT_LENGTH, 500_000),
  corsOrigin: process.env.CORS_ORIGIN || '',
};
