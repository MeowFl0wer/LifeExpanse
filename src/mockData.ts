/**
 * Seed data that pages may still read directly.
 *
 * This is a façade over `src/api/store.ts`, and what it leaves out is the
 * point: **no content is reachable through it.** `allContent`,
 * `getContentBySlug`, the trash functions and the slug allocator are reachable
 * only from `src/api/`, so a page that tries to read or write content without
 * going through the data layer fails to compile.
 *
 * `nextId` is the one general-purpose helper still exported. It allocates ids
 * for the modules below that build their own rows (trajectory, flights,
 * space replies). It cannot reach content — the data layer allocates those
 * ids itself — and it leaves this file with the last of those modules.
 *
 * That matters because permission filtering and the ownership rule live in the
 * data layer. Every time a page has been allowed to read the store directly,
 * it has eventually forgotten one of those rules — private content reachable
 * by slug, deleted content still on the homepage, folders leaking their names
 * to guests. Making it a compile error is cheaper than remembering.
 *
 * The entries below belong to modules that have not been migrated yet
 * (trajectory, footprints, flights, encrypted spaces) plus profile and site
 * chrome. Each one leaves this list as its module moves to `src/api/`.
 */

export {
  // Profile and site chrome
  euanProfile,
  siteStats,
  storageStats,
  deviceSessions,
  adminAccessRecords,
  backupJobs,
  nextId,

  // Library metadata — read-only for pages; writes go through the data layer
  folders,
  series,

  // Trajectory and footprints (not yet migrated)
  trajectoryEntries,
  generateHeatmapData,
  addTrajectoryEntry,
  footprintCities,
  recordFootprintVisit,

  // Flights (not yet migrated)
  flightRecords,
  airports,

  // Encrypted spaces (not yet migrated)
  encryptedSpaces,
  getSpaceByKey,
  getSpaceByPassword,
  getSpacePosts,
  getSpaceReplies,
  addSpaceReply,
  SPACE_LIMIT,
} from './api/store'

export type { TrashEntry } from './api/store'
