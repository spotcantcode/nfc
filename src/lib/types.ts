export type Tag = {
  id: string;
  name: string;
  destination_url: string;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_scanned_at: string | null;
  scan_count: number;
};
export type Scan = {
  id: number;
  tag_id: string;
  scanned_at: string;
  tags?: { name: string } | null;
};
export type Stats = { total: number; active: number; disabled: number; scans: number };
