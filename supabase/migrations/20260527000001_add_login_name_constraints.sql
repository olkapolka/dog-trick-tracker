-- Add CHECK constraint to enforce login_name format
-- Format: lowercase, 3-20 chars, starts with letter, letters/numbers/hyphens only
ALTER TABLE profiles 
  ADD CONSTRAINT login_name_format_check 
  CHECK (login_name ~ '^[a-z][a-z0-9-]{2,19}$');

-- Add length constraint (redundant with regex but explicit)
ALTER TABLE profiles 
  ADD CONSTRAINT login_name_length_check 
  CHECK (char_length(login_name) >= 3 AND char_length(login_name) <= 20);
