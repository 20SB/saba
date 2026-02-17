-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    goal TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    risk_level VARCHAR(20) NOT NULL DEFAULT 'SAFE',
    deployment_target VARCHAR(50) DEFAULT 'local',
    agent_type VARCHAR(100),
    required_tools TEXT[],
    required_permissions TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
