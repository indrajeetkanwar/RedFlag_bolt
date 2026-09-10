import { supabase } from './supabase';
import { normalizeRegistration } from './normalize';
import type { Vehicle, Report, ResultKind, VehicleCheckResult, CommunityReportView } from './types';

export async function checkVehicle(registrationNumber: string): Promise<VehicleCheckResult> {
  const normalized = normalizeRegistration(registrationNumber);

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, registration_number, normalized_registration_number, created_at')
    .eq('normalized_registration_number', normalized)
    .maybeSingle();

  let reports: Report[] = [];

  if (vehicle) {
    const { data: reportData } = await supabase
      .from('reports')
      .select('id, vehicle_id, platform, categories, description, ride_date, created_at, status')
      .eq('vehicle_id', vehicle.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    reports = reportData ?? [];
  }

  const reportCount = reports.length;
  const distinctCategories = new Set(reports.flatMap((r) => r.categories));
  let resultKind: ResultKind = 'clear';

  if (reportCount >= 3 && distinctCategories.size >= 2) {
    resultKind = 'red';
  } else if (reportCount >= 1) {
    resultKind = 'caution';
  }

  await supabase.from('searches').insert({
    vehicle_id: vehicle?.id ?? null,
    search_term: registrationNumber,
  });

  return {
    vehicle: vehicle as Vehicle | null,
    reports: reports as Report[],
    resultKind,
    reportCount,
  };
}

export async function getCommunityReports(vehicleId: string): Promise<CommunityReportView[]> {
  const { data: reportData } = await supabase
    .from('reports')
    .select('id, vehicle_id, platform, categories, description, ride_date, created_at')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const reports = reportData ?? [];

  return reports.map((report) => {
    const dateObj = report.ride_date ? new Date(report.ride_date) : new Date(report.created_at);
    const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return {
      id: report.id,
      category: report.categories[0] ?? 'Other',
      date: monthYear,
      quote: report.description,
      platform: report.platform,
    };
  });
}

export async function submitReport(params: {
  registrationNumber: string;
  platform: string;
  categories: string[];
  description: string;
  rideDate: string;
}): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeRegistration(params.registrationNumber);

  const { data: existingVehicle } = await supabase
    .from('vehicles')
    .select('id')
    .eq('normalized_registration_number', normalized)
    .maybeSingle();

  let vehicleId = existingVehicle?.id ?? null;

  if (!vehicleId) {
    const { data: newVehicle, error: insertError } = await supabase
      .from('vehicles')
      .insert({
        registration_number: params.registrationNumber,
        normalized_registration_number: normalized,
      })
      .select('id')
      .single();

    if (insertError || !newVehicle) {
      return { success: false, error: insertError?.message ?? 'Failed to create vehicle record' };
    }

    vehicleId = newVehicle.id;
  }

  const { error: reportError } = await supabase.from('reports').insert({
    vehicle_id: vehicleId,
    platform: params.platform,
    categories: params.categories,
    description: params.description,
    ride_date: params.rideDate || null,
  });

  if (reportError) {
    return { success: false, error: reportError.message };
  }

  return { success: true };
}
