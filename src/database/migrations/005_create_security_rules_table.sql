-- Create security_rules table
CREATE TABLE IF NOT EXISTS security_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    rule_data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on agent_id for faster queries
CREATE INDEX IF NOT EXISTS idx_security_rules_agent_id ON security_rules(agent_id);

-- Create index on rule_type
CREATE INDEX IF NOT EXISTS idx_security_rules_type ON security_rules(rule_type);

-- Create index on enabled for filtering active rules
CREATE INDEX IF NOT EXISTS idx_security_rules_enabled ON security_rules(enabled);

-- Create updated_at trigger
CREATE TRIGGER update_security_rules_updated_at BEFORE UPDATE ON security_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
