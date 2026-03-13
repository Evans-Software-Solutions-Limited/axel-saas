-- Add gateway_url column to provisioning_state table
ALTER TABLE provisioning_state ADD COLUMN gateway_url TEXT;
