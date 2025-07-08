export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  department?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface ApprovalRequest {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'cancelled';
  amount?: number;
  currency?: string;
  requester_id: number;
  approver_id: number;
  created_at: string;
  updated_at?: string;
  approved_at?: string;
  due_date?: string;
  reference_number?: string;
  external_reference?: string;
  confidentiality_level: string;
  requester: User;
  approver: User;
  comments: ApprovalComment[];
}

export interface ApprovalComment {
  id: number;
  content: string;
  is_internal: boolean;
  user_id: number;
  created_at: string;
  updated_at?: string;
  user: User;
}

export interface CreateApprovalRequest {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  amount?: number;
  approver_id: number;
  due_date?: string;
  external_reference?: string;
  confidentiality_level?: string;
}

export interface UpdateApprovalRequest {
  status: 'approved' | 'rejected' | 'escalated';
  comment?: string;
  approver_id?: number;
}

export interface ApprovalRequestList {
  requests: ApprovalRequest[];
  total: number;
  page: number;
  per_page: number;
}

export interface ApprovalStats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  avg_processing_time_hours: number;
  requests_by_priority: { [key: string]: number };
  requests_by_category: { [key: string]: number };
}

export interface SystemHealth {
  status: string;
  service: string;
  database: string;
  websocket_connections: number;
  timestamp: string;
}

export interface WebSocketStats {
  total_connections: number;
  unique_users: number;
  messages_sent: number;
  role_distribution: { [key: string]: number };
  active_users: number[];
}

export interface WebSocketMessage {
  type: string;
  request_id?: number;
  user_id?: number;
  message: string;
  timestamp: string;
  data?: any;
}

// Utility types
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated' | 'cancelled';
export type UserRole = 'employee' | 'manager' | 'senior_manager' | 'admin';

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

// Filter options for API calls
export interface ApprovalFilters {
  skip?: number;
  limit?: number;
  status?: ApprovalStatus;
  priority?: PriorityLevel;
  category?: string;
  approver_id?: number;
  requester_id?: number;
  search?: string;
}
