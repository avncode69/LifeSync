# PostgreSQL backups and restore

Production provider must supply daily backups and approximately 14 days retention where its plan permits. The application does not assume any provider-specific database feature. Keep an encrypted offsite logical backup, restrict access and define the owner responsible for checking backup alerts.

1. Put the destination staging environment in maintenance mode. Use a new, isolated database; never run a restore over production during a test.
2. Create a custom-format dump using `pg_dump --format=custom --file=lifesync.dump` with the source connection supplied through protected environment configuration. Exclude credentials from shell history and logs.
3. Restore using `pg_restore --no-owner --no-acl --dbname=<isolated staging database> lifesync.dump`. Supply the database connection securely rather than putting real secrets in documentation or commands checked into the repo.
4. Verify migration history, row counts, cross-user authorization and login/session behavior. Test representative projects/tasks, finance summaries and health ownership. Disable Google watches, push and external writes on the restore target until staging provider credentials are configured.
5. Record measured restore duration, timestamp, backup age and the result in the release verification record. Delete temporary unencrypted backups following the owner's retention policy.

Deployment rollback: restore the previous Worker version for application failures. Migrations must remain backward compatible with that version; irreversible data migrations require a reviewed backup/restore plan first. Never automatically drop columns to roll back a failed deployment.

No staging backup restore has been claimed by this document. A successful restore must be executed and recorded before launch.
