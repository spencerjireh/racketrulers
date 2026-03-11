-- Move any COMPLETE tournaments back to UNDERWAY before removing the enum value
UPDATE tournaments SET status = 'UNDERWAY' WHERE status = 'COMPLETE';

-- Recreate the enum without COMPLETE
ALTER TYPE event_status RENAME TO event_status_old;
CREATE TYPE event_status AS ENUM ('PENDING', 'UNDERWAY');
ALTER TABLE tournaments ALTER COLUMN status TYPE event_status USING status::text::event_status;
DROP TYPE event_status_old;
