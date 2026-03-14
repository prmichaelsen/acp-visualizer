# Email Service Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications that send transactional emails
**Status**: Stable

---

## Overview

This pattern provides a lightweight, provider-agnostic email service for sending transactional emails (notifications, digests, confirmations, password resets) from Cloudflare Workers. It wraps email API providers (Mandrill, SendGrid, Resend, etc.) behind a simple `sendEmail({ to, subject, html })` interface and includes HTML template builders for common email types.

The pattern enforces non-blocking email sending — email failures are logged but never crash the calling operation. A user creating a post should never fail because the notification email couldn't be sent.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Need to send transactional emails (confirmations, notifications, digests)
- Using a third-party email API (Mandrill, SendGrid, Resend, Mailgun)
- Want a simple, mockable email interface
- Need HTML email templates

❌ **Don't use this pattern when:**
- Only sending emails via a marketing platform (Mailchimp campaigns)
- Using a full email framework (Nodemailer with SMTP — not available on Workers)
- Email is not a feature of your application

---

## Core Principles

1. **Simple Interface**: `sendEmail({ to, subject, html })` — nothing more
2. **Non-Blocking**: Email failures logged but never thrown — don't crash user flows
3. **Provider-Agnostic**: Wrap any email API behind the same interface
4. **Template Builders**: Separate functions build HTML content
5. **Server-Side Only**: Email sending only from API routes, cron jobs, and server functions
6. **Secrets via Environment**: API keys stored as Cloudflare secrets, never hardcoded

---

## Implementation

### Structure

```
src/lib/
├── email/
│   ├── send-email.ts          # Core send function
│   ├── templates/
│   │   ├── base.ts            # Base HTML wrapper
│   │   ├── welcome.ts         # Welcome email template
│   │   ├── daily-digest.ts    # Daily digest template
│   │   ├── appointment.ts     # Appointment notification
│   │   └── password-reset.ts  # Password reset template
│   └── index.ts               # Barrel export
```

### Code Example

#### Step 1: Core Send Function

```typescript
// src/lib/email/send-email.ts

const MANDRILL_API_URL = 'https://mandrillapp.com/api/1.0/messages/send'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  from?: string
  fromName?: string
}

interface SendEmailResult {
  success: boolean
  error?: string
}

/**
 * Send a transactional email via Mandrill.
 * Non-blocking: logs errors but never throws.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.MANDRILL_API_KEY

  if (!apiKey) {
    console.error('[Email] Mandrill API key not configured')
    return { success: false, error: 'API key not configured' }
  }

  const recipients = Array.isArray(params.to)
    ? params.to.map(email => ({ email, type: 'to' as const }))
    : [{ email: params.to, type: 'to' as const }]

  try {
    const response = await fetch(MANDRILL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: apiKey,
        message: {
          html: params.html,
          subject: params.subject,
          from_email: params.from || 'noreply@example.com',
          from_name: params.fromName || 'My App',
          to: recipients,
          important: true,
          track_opens: true,
          track_clicks: true,
          auto_text: true,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Email] Send failed:', error)
      return { success: false, error }
    }

    const data = await response.json()
    console.log(`[Email] Sent "${params.subject}" to ${recipients.length} recipient(s)`)
    return { success: true }
  } catch (error) {
    console.error('[Email] Send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

#### Step 2: Base HTML Template

```typescript
// src/lib/email/templates/base.ts

interface BaseTemplateParams {
  title: string
  body: string
  footerText?: string
}

/**
 * Base HTML email wrapper with consistent styling
 */
export function baseTemplate({ title, body, footerText }: BaseTemplateParams): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; margin: 20px 0; }
    .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee; margin-bottom: 20px; }
    .footer { text-align: center; color: #888; font-size: 12px; padding: 20px 0; }
    h1 { color: #333; font-size: 24px; margin: 0; }
    p { color: #555; line-height: 1.6; }
    .btn { display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>${title}</h1>
      </div>
      ${body}
    </div>
    <div class="footer">
      ${footerText || 'You are receiving this because you have an account with us.'}
    </div>
  </div>
</body>
</html>`
}
```

#### Step 3: Domain-Specific Template

```typescript
// src/lib/email/templates/daily-digest.ts

import { baseTemplate } from './base'

interface DigestData {
  checkIns: { guestName: string; property: string }[]
  checkOuts: { guestName: string; property: string }[]
  unclaimedCleans: { property: string; date: string }[]
}

export function dailyDigestTemplate(data: DigestData): string {
  const sections: string[] = []

  if (data.checkIns.length > 0) {
    sections.push(`
      <h2>Check-Ins Today (${data.checkIns.length})</h2>
      <ul>
        ${data.checkIns.map(c => `<li><strong>${c.guestName}</strong> at ${c.property}</li>`).join('')}
      </ul>
    `)
  }

  if (data.checkOuts.length > 0) {
    sections.push(`
      <h2>Check-Outs Today (${data.checkOuts.length})</h2>
      <ul>
        ${data.checkOuts.map(c => `<li><strong>${c.guestName}</strong> at ${c.property}</li>`).join('')}
      </ul>
    `)
  }

  if (data.unclaimedCleans.length > 0) {
    sections.push(`
      <h2>Unclaimed Cleans (${data.unclaimedCleans.length})</h2>
      <ul>
        ${data.unclaimedCleans.map(c => `<li>${c.property} — ${c.date}</li>`).join('')}
      </ul>
    `)
  }

  if (sections.length === 0) {
    sections.push('<p>No activity to report today.</p>')
  }

  return baseTemplate({
    title: `Daily Digest — ${new Date().toLocaleDateString()}`,
    body: sections.join(''),
  })
}
```

#### Step 4: Use in Application Code

```typescript
// src/lib/scheduled/daily-digest.ts

import { sendEmail } from '@/lib/email'
import { dailyDigestTemplate } from '@/lib/email/templates/daily-digest'

export async function handleDailyDigest(): Promise<void> {
  const checkIns = await ReservationDatabaseService.getTodayCheckIns()
  const checkOuts = await ReservationDatabaseService.getTodayCheckOuts()
  const unclaimedCleans = await AppointmentDatabaseService.getUnclaimedNextWeek()

  const html = dailyDigestTemplate({ checkIns, checkOuts, unclaimedCleans })

  await sendEmail({
    to: ['manager@example.com', 'ops@example.com'],
    subject: `Daily Digest — ${new Date().toLocaleDateString()}`,
    html,
  })
}
```

#### Step 5: Use in API Route (Non-Blocking)

```typescript
// routes/api/posts/create.tsx

POST: async ({ request }) => {
  const user = await getAuthSession()
  const body = await request.json()
  const post = await PostDatabaseService.create(user.uid, body)

  // Send notification email (non-blocking)
  sendEmail({
    to: 'admin@example.com',
    subject: `New post: ${body.title}`,
    html: baseTemplate({
      title: 'New Post Created',
      body: `<p>${user.displayName} created a new post: <strong>${body.title}</strong></p>`,
    }),
  }).catch(error => console.error('[Email] Notification failed:', error))
  // Note: not awaited — fire and forget

  return new Response(JSON.stringify(post), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

---

## Swapping Providers

The `sendEmail` function wraps a single provider. To swap providers, change only that file:

### Mandrill → SendGrid

```typescript
// src/lib/email/send-email.ts (SendGrid version)
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.from || 'noreply@example.com' },
      subject: params.subject,
      content: [{ type: 'text/html', value: params.html }],
    }),
  })
  // ...
}
```

### Mandrill → Resend

```typescript
// src/lib/email/send-email.ts (Resend version)
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from || 'noreply@example.com',
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  })
  // ...
}
```

---

## Benefits

### 1. Simple Interface
`sendEmail({ to, subject, html })` — no provider-specific knowledge needed in calling code.

### 2. Non-Blocking
Email failures never crash user operations. Fire-and-forget pattern for notifications.

### 3. Provider Swappable
Change email provider by editing one file. No impact on templates or callers.

### 4. Testable
`sendEmail` is easily mockable for testing. Templates are pure functions returning strings.

---

## Trade-offs

### 1. HTML Templates as Strings
**Downside**: Building HTML in template literals is error-prone and hard to preview.
**Mitigation**: Use the base template for consistent structure. Test templates by rendering in a browser.

### 2. No MJML/React Email
**Downside**: Not using modern email frameworks (MJML, React Email).
**Mitigation**: These can be added later. The `sendEmail` interface stays the same — only template builders change.

---

## Anti-Patterns

### ❌ Anti-Pattern: Throwing on Email Failure

```typescript
// ❌ BAD: Email failure crashes the post creation
const post = await PostService.create(data)
await sendEmail({ to, subject, html })  // If this throws, post appears to fail!
return post

// ✅ GOOD: Fire and forget
const post = await PostService.create(data)
sendEmail({ to, subject, html }).catch(err => console.error('[Email]', err))
return post
```

### ❌ Anti-Pattern: Inline HTML in Route Handlers

```typescript
// ❌ BAD: HTML template inline in route
await sendEmail({
  to: user.email,
  subject: 'Welcome',
  html: `<html><body><h1>Welcome ${user.name}!</h1><p>...</p></body></html>`
})

// ✅ GOOD: Use template function
import { welcomeTemplate } from '@/lib/email/templates/welcome'
await sendEmail({
  to: user.email,
  subject: 'Welcome',
  html: welcomeTemplate({ name: user.name })
})
```

---

## Related Patterns

- **[Scheduled Tasks](./tanstack-cloudflare.scheduled-tasks.md)**: Cron-triggered emails (daily digests, reminders)
- **[Third-Party API Integration](./tanstack-cloudflare.third-party-api-integration.md)**: Email provider as an integration
- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: Email sent from API routes

---

## Checklist for Implementation

- [ ] `sendEmail()` function with `{ to, subject, html }` interface
- [ ] Returns `{ success, error? }` — never throws
- [ ] API key stored as Cloudflare secret
- [ ] Base HTML template with consistent styling
- [ ] Domain-specific template functions (digest, notification, etc.)
- [ ] Templates are pure functions (string input → string output)
- [ ] Non-critical emails sent fire-and-forget (`.catch()`)
- [ ] Critical emails awaited but wrapped in try/catch
- [ ] Multiple recipients supported (string or string array)
- [ ] Provider can be swapped by editing one file

---

**Status**: Stable - Production-ready email service for Cloudflare Workers
**Recommendation**: Use for all transactional email needs
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
