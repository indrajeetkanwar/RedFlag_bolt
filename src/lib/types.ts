export type Vehicle = {
  id: string;
  registration_number: string;
  normalized_registration_number: string;
  created_at: string;
};

export type Report = {
  id: string;
  vehicle_id: string;
  platform: string;
  categories: string[];
  description: string;
  ride_date: string | null;
  created_at: string;
  status: string;
};

export type ResultKind = 'clear' | 'caution' | 'red';

export type VehicleCheckResult = {
  vehicle: Vehicle | null;
  reports: Report[];
  resultKind: ResultKind;
  reportCount: number;
};

export type CommunityReportView = {
  id: string;
  category: string;
  date: string;
  quote: string;
  platform: string;
};
