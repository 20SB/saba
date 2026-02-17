-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL,
    plan_data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on agent_id for faster queries
CREATE INDEX IF NOT EXISTS idx_plans_agent_id ON plans(agent_id);

-- Create index on plan_type for filtering
CREATE INDEX IF NOT EXISTS idx_plans_plan_type ON plans(plan_type);

-- Create index on agent_id and plan_type combination
CREATE INDEX IF NOT EXISTS idx_plans_agent_type ON plans(agent_id, plan_type);

-- Create updated_at trigger
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
