-- Private materials bucket + storage RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;

-- Students can manage only their own prefix: {user_id}/...
CREATE POLICY materials_select_own ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY materials_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY materials_update_own ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY materials_delete_own ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);
