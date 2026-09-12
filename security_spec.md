# Security Specification for Poly Royale

## 1. Data Invariants
1. **Identity Binding**: A user document at `/users/{userId}` can only be created, read, or updated if `request.auth.uid == userId`.
2. **Leaderboard Integrity**: A user can only write their own leaderboard entry at `/leaderboard/{userId}` matching `request.auth.uid == userId`.
3. **Immutability of IDs & Timestamps**: The `userId` and `createdAt` fields are immutable after document creation.
4. **Sanitized Input Bounds**: User display names must be strings between 1 and 30 characters. Stat numbers (`totalWins`, `totalKills`, `totalMatches`) must be non-negative integers.
5. **No Blind Writes / Shadow Fields**: Incoming payloads must only contain explicitly allowed keys. Extra unexpected fields are rejected.

## 2. The Dirty Dozen Payloads (Rejection Targets)
1. **Payload 1 (Impersonation Write)**: Trying to create `/users/victimUid` with `request.auth.uid = attackerUid`. (Rejected: UID mismatch)
2. **Payload 2 (Unauthenticated Write)**: Trying to write `/users/testUid` with `request.auth == null`. (Rejected: unauthenticated)
3. **Payload 3 (Unverified Email Write)**: Trying to write when `token.email_verified == false`. (Rejected: requires verified email or auth)
4. **Payload 4 (Ghost Field Injection)**: Sending `{ userId, displayName, totalWins: 0, totalKills: 0, totalMatches: 0, isAdmin: true }` to `/users/{userId}`. (Rejected: forbidden extra key `isAdmin`)
5. **Payload 5 (Name Buffer Overflow)**: Sending a `displayName` with 500 characters. (Rejected: size > 30)
6. **Payload 6 (Negative Stats)**: Sending `totalWins: -50`. (Rejected: stats must be >= 0)
7. **Payload 7 (ID Modification on Update)**: Changing `userId` from `userA` to `userB` during an update. (Rejected: immutable field)
8. **Payload 8 (CreatedAt Modification)**: Altering the original `createdAt` timestamp during an update. (Rejected: immutable field)
9. **Payload 9 (Leaderboard Hijack)**: Overwriting another user's score at `/leaderboard/rivalUid`. (Rejected: auth UID mismatch)
10. **Payload 10 (Path Traversal ID)**: Using document ID `../../system/root` with illegal characters. (Rejected: `isValidId` regex failure)
11. **Payload 11 (Blanket Collection Scraping)**: Unauthenticated query to list all private `/users`. (Rejected: user profile reads restricted to owner)
12. **Payload 12 (Invalid Class Enum)**: Sending `favoriteClass: "godmode"`. (Rejected: enum validation failure)

## 3. Test Runner Design
Unit tests simulate each of the Dirty Dozen scenarios against the security rules to ensure `PERMISSION_DENIED` is returned on all malicious attempts.
