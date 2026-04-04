-- Add workspace_ready to provisioning_status enum.
-- This separates "workspace files written" from "agent container live".
ALTER TYPE provisioning_status ADD VALUE IF NOT EXISTS 'workspace_ready' BEFORE 'provisioning';
