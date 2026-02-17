-- Create approvals table
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    approval_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    telegram_message_id VARCHAR(100),
    request_data JSONB DEFAULT '{}',
    response_data JSONB DEFAULT '{}',
    approved_by VARCHAR(100),
    approval_notes TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on agent_id for faster queries
CREATE INDEX IF NOT EXISTS idx_approvals_agent_id ON approvals(agent_id);

-- Create index on status for filtering pending approvals
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- Create index on approval_type
CREATE INDEX IF NOT EXISTS idx_approvals_type ON approvals(approval_type);
