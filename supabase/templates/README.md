# Auth email templates

Plain, branded templates for the two emails Supabase Auth sends. Paste each
into Supabase: Authentication → Emails → Templates.

| Template | File | Subject |
| --- | --- | --- |
| Confirm signup | `confirm.html` | Confirm your Ballboy Sabi account |
| Reset password | `recovery.html` | Reset your Ballboy Sabi password |

`{{ .ConfirmationURL }}` is filled in by Supabase. The site name is written
out ("Ballboy Sabi"): if SITE_NAME changes, change it here too.

They go out through Brevo once custom SMTP is set (Authentication → Emails →
SMTP settings): host `smtp-relay.brevo.com`, port 587, and the SMTP login and
key from Brevo (SMTP & API → SMTP).
