-- Create public bucket for dog photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dog-photos',
  'dog-photos',
  true,
  2097152,  -- 2MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
-- RLS policies for storage.objects
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dog-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dog-photos');
CREATE POLICY "Users can update own photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'dog-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dog-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
