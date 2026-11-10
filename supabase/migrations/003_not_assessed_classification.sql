-- Allow Not Assessed mastery state (unattempted topics must not be Weak).

ALTER TABLE topic_mastery
  DROP CONSTRAINT IF EXISTS topic_mastery_classification_check;

ALTER TABLE topic_mastery
  ADD CONSTRAINT topic_mastery_classification_check
  CHECK (classification IN ('weak', 'medium', 'strong', 'not_assessed'));

ALTER TABLE topic_mastery
  ALTER COLUMN classification SET DEFAULT 'not_assessed';
