-- Add length constraints to dog_name and breed fields
-- Prevents pathological inputs while allowing reasonable real-world values
ALTER TABLE profiles 
  ADD CONSTRAINT dog_name_length_check 
  CHECK (char_length(dog_name) <= 100);

ALTER TABLE profiles 
  ADD CONSTRAINT breed_length_check 
  CHECK (char_length(breed) <= 100);
