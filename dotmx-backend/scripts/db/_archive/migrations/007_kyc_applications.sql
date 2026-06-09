-- KYC Applications Table
-- Migration 007: Create kyc_applications table for tracking KYC submissions

BEGIN;

-- ============================================
-- KYC Applications Table
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3)),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
    
    -- Personal Information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    nationality VARCHAR(100),
    
    -- Address Information
    country VARCHAR(100),
    state_province VARCHAR(100),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    
    -- Additional verification data
    phone VARCHAR(50),
    occupation VARCHAR(100),
    source_of_funds TEXT,
    
    -- Review Information
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    admin_notes TEXT,
    
    -- Risk assessment
    risk_score INTEGER,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Metadata
    submitted_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_kyc_applications_user ON kyc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_status ON kyc_applications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_level ON kyc_applications(level);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_created ON kyc_applications(created_at DESC);

-- ============================================
-- Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_kyc_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kyc_applications_updated_at
    BEFORE UPDATE ON kyc_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_kyc_applications_updated_at();

COMMIT;
