# Firebase Anonymous Sessions & Account Upgrade

**Category**: Code
**Applicable To**: Anonymous user auto-creation, feature gating by auth tier, anonymous-to-real account upgrade, and data preservation across upgrade
**Status**: Stable

---

## Overview

This pattern covers the anonymous session lifecycle: auto-creation on first visit, feature gating based on anonymous vs real user, the upgrade flow that preserves the user's UID and all associated data, and the message-limit-to-signup funnel. Every visitor gets a Firebase UID immediately — anonymous users can chat in The Void with a message limit, and upgrading to a real account links credentials to the same UID so no data is lost.

---

## When to Use This Pattern

**Use this pattern when:**
- Adding a new feature that should be restricted to real (non-anonymous) users
- Building a new public-facing page that anonymous users can access
- Adding a new capability to The Void or other anonymous-accessible areas
- Implementing a new signup prompt or conversion funnel
- Checking whether a user should see premium/gated features

**Don't use this pattern when:**
- Working on server-only code that already receives a verified userId
- Building admin-only features (use `requireAdmin` guard instead)
- Implementing MCP server auth (separate JWT system)

---

## Core Principles

1. **Every Visitor Gets a UID**: Anonymous sign-in happens automatically on first visit — no user action needed
2. **Same UID After Upgrade**: `linkWithCredential()` preserves the anonymous UID, so all prior data (conversations, memories, relationships) stays intact
3. **Gate Features, Not Access**: Anonymous users can browse and chat — restrict actions (publish, friend, rate) not pages
4. **Null-Safe Helpers**: Use `isRealUser(user)` — handles null, undefined, and anonymous in one check
5. **One Attempt Per Session**: Anonymous sign-in is guarded by a ref to prevent duplicate calls

---

## Implementation

### Anonymous Session Lifecycle

```
First Visit                    Chat in Void              Sign Up
    │                              │                        │
    ├─ AuthProvider mounts         │                        │
    ├─ onAuthChange(null)          │                        │
    ├─ signInAnonymously()         │                        │
    ├─ POST /api/auth/login ──►    │                        │
    │  (creates session cookie)    │                        │
    │                              │                        │
    │  user.isAnonymous = true     │                        │
    │                              ├─ 10 message limit      │
    │                              ├─ SignupCta shown       │
    │                              │                        │
    │                              │                        ├─ upgradeAnonymousAccount()
    │                              │                        ├─ linkWithCredential()
    │                              │                        ├─ POST /api/auth/login
    │                              │                        │  (new session cookie)
    │                              │                        │
    │                              │                        │  SAME UID ✓
    │                              │                        │  All data preserved ✓
    │                              │                        │  user.isAnonymous = false
```

### Auto-Creation in AuthProvider

**File**: `src/components/auth/AuthContext.tsx`

```typescript
export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser as User | null)
  const anonSignInAttempted = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setAnalyticsUserId(firebaseUser.uid)
      }

      // Auto sign-in anonymously if no user exists (once per session)
      if (!firebaseUser && !anonSignInAttempted.current) {
        anonSignInAttempted.current = true
        signInAnonymously()
          .then(async (cred) => {
            const idToken = await cred.user.getIdToken()
            await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            })
          })
          .catch((err) => {
            console.error('[AuthProvider] Anonymous sign-in failed:', err)
          })
        return // onAuthChange will fire again with the anonymous user
      }

      setUser(firebaseUser)
    })

    return unsubscribe
  }, [])

  return <AuthContext.Provider value={{ user, loading: false }}>{children}</AuthContext.Provider>
}
```

Key details:
- `anonSignInAttempted` ref prevents duplicate sign-in attempts
- After `signInAnonymously()` succeeds, `onAuthChange` fires again with the new user
- Session cookie created immediately so server-side auth works

### Firebase Client Functions

**File**: `src/lib/firebase-client.ts`

```typescript
// Create anonymous account
export async function signInAnonymously(): Promise<UserCredential> {
  const auth = getFirebaseAuth()
  return firebaseSignInAnonymously(auth)
}

// Upgrade anonymous to email/password
export async function upgradeAnonymousAccount(
  email: string,
  password: string
): Promise<UserCredential> {
  const auth = getFirebaseAuth()
  if (!auth.currentUser?.isAnonymous) {
    throw new Error('Current user is not anonymous')
  }
  const credential = EmailAuthProvider.credential(email, password)
  return linkWithCredential(auth.currentUser, credential)
}

// Upgrade anonymous via OAuth popup
export async function upgradeAnonymousWithPopup(
  provider: AuthProvider
): Promise<UserCredential> {
  const auth = getFirebaseAuth()
  if (!auth.currentUser?.isAnonymous) {
    throw new Error('Current user is not anonymous')
  }
  return linkWithPopup(auth.currentUser, provider)
}
```

### Detection Helpers

**File**: `src/lib/auth/helpers.ts`

```typescript
/** Client-side: true if authenticated with a real (non-anonymous) account */
export function isRealUser(user: User | null | undefined): boolean {
  return !!user && !user.isAnonymous
}

/** Server-side: true if authenticated with a real (non-anonymous) account */
export function isRealUserServer(user: ServerUser | null | undefined): boolean {
  return !!user && !user.isAnonymous
}
```

**Server-side detection** (`src/lib/auth/session.ts`):

```typescript
const isAnonymous =
  decodedToken.firebase?.sign_in_provider === 'anonymous' || !decodedToken.email
```

### Signup Flow with Upgrade Detection

**File**: `src/components/auth/AuthForm.tsx`

```typescript
// Signup handler
const auth = getFirebaseAuth()
let userCredential

if (auth.currentUser?.isAnonymous) {
  // Upgrade: links email/password to existing anonymous UID
  userCredential = await upgradeAnonymousAccount(email, password)
} else {
  // Fresh signup: creates new account
  userCredential = await signUp(email, password)
}

// Both paths: exchange ID token for session cookie
const idToken = await userCredential.user.getIdToken()
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken, turnstileToken }),
})
```

---

## Examples

### Example 1: Feature Gating in a Component

```typescript
// Hide friend actions for anonymous users
function ProfileActionBar({ profileUserId }: Props) {
  const { user } = useAuth()

  // Anonymous users and own profile — hide actions
  if (!isRealUser(user) || user.uid === profileUserId) return null

  return (
    <div>
      <AddFriendButton userId={profileUserId} />
      <SendMessageButton userId={profileUserId} />
    </div>
  )
}
```

### Example 2: Feature Gating in Header

```typescript
// Only show notification bell for real users
function UnifiedHeader() {
  const { user } = useAuth()

  const bell = isRealUser(user) ? <NotificationBell userId={user.uid} /> : null

  return (
    <header>
      {bell}
      {/* other header content */}
    </header>
  )
}
```

### Example 3: Skipping Server Operations for Anonymous Users

```typescript
// Don't track preferences or consent for anonymous users
function UIPreferencesProvider({ children }: Props) {
  const { user } = useAuth()

  useEffect(() => {
    if (!isRealUser(user)) return // Skip for anonymous
    PreferencesService.loadPreferences(user.uid).then(setPrefs)
  }, [user])

  const updatePref = useCallback((key, value) => {
    if (!isRealUser(user)) return // Skip for anonymous
    PreferencesService.updatePreference(user.uid, key, value)
  }, [user])

  return <UIPreferencesContext.Provider value={{ prefs, updatePref }}>{children}</UIPreferencesContext.Provider>
}
```

### Example 4: Anonymous Chat with Message Limit

```typescript
// Chat route — anonymous users access main conversation only
if (conversationId === 'main' && (!user || user.isAnonymous)) {
  return new Response(JSON.stringify({
    conversation: { id: 'main', title: 'Void Ghost' }
  }), { status: 200 })
}

// ChatInterface — enforce message limit for anonymous
<ChatInterface
  conversationId={conversationId}
  anonMessageLimit={10}
  disabledMessage={
    <SignupCta message="You've hit your limit. Sign up to keep chatting!" />
  }
/>
```

### Example 5: API Route Rejecting Anonymous Users

```typescript
GET: async () => {
  initFirebaseAdmin()

  const user = await getAuthSession()
  if (!user || user.isAnonymous) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Only real users reach here
  const data = await SomeDatabaseService.getData(user.uid)
  return new Response(JSON.stringify({ data }), { status: 200 })
}
```

### Example 6: SSR beforeLoad Auth Redirect

```typescript
// Settings page — redirect anonymous users to auth
beforeLoad: (async ({ context }: any) => {
  const user = context.initialUser
  if (!user || user.isAnonymous) {
    throw redirect({
      to: '/auth',
      search: { redirect_url: '/settings' },
    })
  }
  return { initialUser: user }
}) as any
```

---

## Anti-Patterns

### Checking `user === null` Instead of `isRealUser()`

```typescript
// Bad: Misses anonymous users — they have a user object but shouldn't access features
if (!user) return <LoginPrompt />
return <ProtectedFeature />  // Anonymous users get through!

// Good: Handles null, undefined, and anonymous in one check
if (!isRealUser(user)) return <LoginPrompt />
return <ProtectedFeature />
```

### Creating a New Account Instead of Upgrading

```typescript
// Bad: Creates a new UID — all anonymous data is orphaned
const userCredential = await signUp(email, password)  // New UID!

// Good: Check if anonymous first, upgrade to preserve UID
const auth = getFirebaseAuth()
if (auth.currentUser?.isAnonymous) {
  userCredential = await upgradeAnonymousAccount(email, password)  // Same UID
} else {
  userCredential = await signUp(email, password)
}
```

### Multiple Anonymous Sign-In Attempts

```typescript
// Bad: No guard — creates multiple anonymous accounts
useEffect(() => {
  if (!user) signInAnonymously()  // Fires on every render!
}, [user])

// Good: Ref guard ensures single attempt
const attempted = useRef(false)
useEffect(() => {
  if (!user && !attempted.current) {
    attempted.current = true
    signInAnonymously()
  }
}, [user])
```

### Gating Pages Instead of Actions

```typescript
// Bad: Blocks anonymous users from browsing public content
if (!isRealUser(user)) throw redirect({ to: '/auth' })
return <PublicProfilePage />  // Anonymous should be able to browse!

// Good: Let anonymous browse, gate specific actions
return (
  <PublicProfilePage>
    {isRealUser(user) && <AddFriendButton />}
    {isRealUser(user) && <SendMessageButton />}
  </PublicProfilePage>
)
```

---

## Key Design Decisions

### Anonymous Sessions

| Decision | Choice | Rationale |
|---|---|---|
| Auto-creation | On first visit, no user action | Every visitor gets a UID for chat and tracking |
| Session cookie | Same 14-day cookie as real users | Uniform server-side auth — no special anonymous path |
| Message limit | 10 messages in The Void | Conversion funnel — enough to experience chat, then prompt signup |
| Sign-in guard | `useRef` one-attempt flag | Prevents duplicate anonymous accounts from React re-renders |

### Account Upgrade

| Decision | Choice | Rationale |
|---|---|---|
| Upgrade method | `linkWithCredential()` | Firebase preserves UID — all data stays under same account |
| Detection | `auth.currentUser?.isAnonymous` | Simple check before signup; transparent to user |
| Data migration | None needed | Same UID means same Firestore paths — zero data migration |
| OAuth upgrade | `linkWithPopup()` available | Supports Google/GitHub upgrade alongside email/password |

### Feature Gating

| Decision | Choice | Rationale |
|---|---|---|
| Gating strategy | Gate actions, not pages | Anonymous users can browse profiles, feeds, spaces — just can't interact |
| Helper function | `isRealUser()` | Single null-safe check; avoids repeated `!user \|\| user.isAnonymous` |
| Server gating | Check `user.isAnonymous` in API routes | Return 401 for features requiring real account |
| Consent/preferences | Skip for anonymous | No point collecting consent or persisting preferences for transient users |

---

## Checklist for Implementation

- [ ] Use `isRealUser(user)` for feature gating — never check `user === null` alone
- [ ] Gate actions (publish, friend, rate) not pages (browse, search, view)
- [ ] Check `auth.currentUser?.isAnonymous` before signup to trigger upgrade path
- [ ] After upgrade, create new session cookie via `/api/auth/login`
- [ ] API routes checking anonymous: `if (!user || user.isAnonymous)` → 401
- [ ] SSR routes for protected pages: redirect to `/auth?redirect_url=...`
- [ ] Public pages: allow anonymous access, hide action buttons with `isRealUser()`
- [ ] Never call `signInAnonymously()` without a one-attempt ref guard

---

## Related Patterns

- **[Firebase Auth](./tanstack-cloudflare.firebase-auth.md)**: Session cookie management, `getAuthSession()`, route guards
- **[Firebase Firestore](./tanstack-cloudflare.firebase-firestore.md)**: All user data keyed by UID — preserved across upgrade
- **[SSR Preload](./ssr-preload.md)**: `beforeLoad` uses `context.initialUser` which may be anonymous

---

**Status**: Stable
**Recommendation**: Always use `isRealUser()` for feature gating. Always check `isAnonymous` before signup to trigger the upgrade path and preserve user data.
**Last Updated**: 2026-03-14
**Contributors**: Community
