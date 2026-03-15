import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database types
export interface SenderEmail {
  id: string;
  email_address: string;
  display_name: string | null;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  app_password_enc: string;
  daily_limit: number;
  is_verified: boolean;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  sender_email_id: string | null;
  otp_length: number;
  otp_expiry_seconds: number;
  otp_max_attempts: number;
  otp_subject_tmpl: string | null;
  otp_body_tmpl: string | null;
  otp_format: 'text' | 'html';
  rate_limit_per_hour: number;
  is_active: boolean;
  created_at: string;
  sender_email?: SenderEmail;
}

export interface ApiKey {
  id: string;
  project_id: string;
  key_hash: string;
  key_prefix: string;
  label: string | null;
  is_sandbox: boolean;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  project?: Project;
}

export interface OtpRecord {
  id: string;
  project_id: string;
  recipient_email: string;
  otp_hash: string;
  purpose: string;
  attempts_count: number;
  is_verified: boolean;
  is_invalidated: boolean;
  expires_at: string;
  verified_at: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface EmailLog {
  id: string;
  project_id: string;
  sender_email_id: string;
  type: 'otp' | 'transactional' | 'template';
  recipient_email: string;
  subject: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  smtp_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface BotSession {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

// Create Supabase client singleton
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    }
    
    supabaseInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  return supabaseInstance;
}

// Export the client for direct use
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  }
});

// Database helper functions
export const db = {
  // Projects
  async getProjectBySlug(slug: string): Promise<Project | null> {
    const { data, error } = await getSupabase()
      .from('projects')
      .select('*, sender_emails(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    
    if (error) return null;
    return data;
  },
  
  async getProjectById(id: string): Promise<Project | null> {
    const { data, error } = await getSupabase()
      .from('projects')
      .select('*, sender_emails(*)')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  },
  
  // API Keys
  async getApiKeyByHash(keyHash: string): Promise<(ApiKey & { project: Project }) | null> {
    const { data, error } = await getSupabase()
      .from('api_keys')
      .select('*, projects(*)')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();
    
    if (error) return null;
    
    // Transform the nested project data
    return {
      ...data,
      project: data.projects as Project
    };
  },
  
  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    await getSupabase()
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyId);
  },
  
  // Sender Emails
  async getSenderById(id: string): Promise<SenderEmail | null> {
    const { data, error } = await getSupabase()
      .from('sender_emails')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  },
  
  async updateSenderLastUsed(senderId: string): Promise<void> {
    await getSupabase()
      .from('sender_emails')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', senderId);
  },
  
  // OTP Records
  async getActiveOtp(projectId: string, email: string): Promise<OtpRecord | null> {
    const { data, error } = await getSupabase()
      .from('otp_records')
      .select('*')
      .eq('project_id', projectId)
      .eq('recipient_email', email)
      .eq('is_verified', false)
      .eq('is_invalidated', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) return null;
    return data;
  },
  
  async invalidatePreviousOtps(projectId: string, email: string): Promise<void> {
    await getSupabase()
      .from('otp_records')
      .update({ is_invalidated: true })
      .eq('project_id', projectId)
      .eq('recipient_email', email)
      .eq('is_verified', false)
      .eq('is_invalidated', false);
  },
  
  async incrementOtpAttempts(otpId: string): Promise<void> {
    await getSupabase().rpc('increment_otp_attempts', { otp_id: otpId });
  }
};