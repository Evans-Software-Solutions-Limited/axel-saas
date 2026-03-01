-- Add gateway_token column to provisioning_state table
ALTER TABLE provisioning_state ADD COLUMN gateway_token TEXT;
