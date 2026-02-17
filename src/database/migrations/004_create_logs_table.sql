-- Create logs table
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    log_type VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    error_stack TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on agent_id for faster queries
CREATE INDEX IF NOT EXISTS idx_logs_agent_id ON logs(agent_id);

-- Create index on log_type for filtering
CREATE INDEX IF NOT EXISTS idx_logs_log_type ON logs(log_type);

-- Create index on level for filtering errors
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

-- Create composite index for agent logs by time
CREATE INDEX IF NOT EXISTS idx_logs_agent_time ON logs(agent_id, created_at DESC);
