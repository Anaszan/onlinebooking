export type MemberRole = "owner" | "admin" | "manager" | "staff";
export type TenantStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired";
export type DomainStatus = "pending_verification" | "verified" | "provisioning" | "active" | "failed";

export interface Plan {
  id: string;
  code: string;
  name: string;
  price_monthly: number;
  max_branches: number | null;
  max_staff: number | null;
  max_services: number | null;
  max_bookings_per_month: number | null;
  features: Record<string, boolean>;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  accent_color: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_line: string | null;
  status: TenantStatus;
  plan_id: string | null;
  trial_ends_at: string | null;
  slot_interval_minutes: number;
  min_advance_minutes: number;
  max_advance_days: number;
  cancel_cutoff_hours: number;
  auto_confirm: boolean;
  created_at: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  is_active: boolean;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  duration_minutes: number;
  buffer_before_min: number;
  buffer_after_min: number;
  price: number;
  is_online_bookable: boolean;
  is_active: boolean;
  sort_order: number;
  category: ServiceCategory;
  species: Species[];
}

export type Species = "dog" | "cat" | "rabbit" | "bird" | "other";
export type ServiceCategory = "grooming" | "bath" | "spa" | "boarding" | "daycare" | "vet" | "vaccine" | "training" | "other";

export const SPECIES: Species[] = ["dog", "cat", "rabbit", "bird", "other"];
export const SPECIES_LABELS: Record<Species, string> = {
  dog: "สุนัข",
  cat: "แมว",
  rabbit: "กระต่าย",
  bird: "นก",
  other: "อื่น ๆ",
};
export const SPECIES_EMOJI: Record<Species, string> = { dog: "🐶", cat: "🐱", rabbit: "🐰", bird: "🐦", other: "🐾" };

export const SERVICE_CATEGORIES: ServiceCategory[] = ["grooming", "bath", "spa", "boarding", "daycare", "vet", "vaccine", "training", "other"];
export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  grooming: "ตัดขน / กรูมมิ่ง",
  bath: "อาบน้ำ",
  spa: "สปา",
  boarding: "รับฝากเลี้ยง",
  daycare: "เดย์แคร์",
  vet: "ตรวจสุขภาพ",
  vaccine: "ฉีดวัคซีน",
  training: "ฝึกพฤติกรรม",
  other: "บริการอื่น ๆ",
};

export interface Pet {
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string;
  species: Species;
  breed: string | null;
  weight_kg: number | null;
  notes: string | null;
  photo_path: string | null;
  created_at: string;
}

export interface Staff {
  id: string;
  tenant_id: string;
  branch_id: string;
  user_id: string | null;
  display_name: string;
  title: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface WorkingHour {
  id: string;
  tenant_id: string;
  staff_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TimeOff {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface Customer {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  branch_id: string;
  service_id: string;
  staff_id: string;
  customer_id: string;
  reference_code: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price: number;
  customer_note: string | null;
  internal_note: string | null;
  source: string;
  created_at: string;
}

export interface Domain {
  id: string;
  tenant_id: string;
  hostname: string;
  status: DomainStatus;
  verification_token: string;
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  checked_in: "เช็กอินแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  no_show: "ไม่มาตามนัด",
  expired: "หมดอายุ",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "เจ้าของ",
  admin: "ผู้ดูแล",
  manager: "ผู้จัดการ",
  staff: "พนักงาน",
};
