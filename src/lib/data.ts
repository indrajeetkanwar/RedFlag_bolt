import { supabase } from './supabase';
import { normalizeRegistration } from './normalize';
import { getClientKey } from './clientKey';
import { validateDescription } from './reportValidation';
import type { Vehicle, Report, ResultKind, VehicleCheckResult, CommunityReportView } from './types';

/** Lightweight rate limit: reports allowed per browser (client_key) per window. */
const MAX_REPORTS_PER_WINDOW = 3;
const REPORT_WINDOW_MINUTES = 60;
/** A report with the same vehicle + same text inside this window is treated as a duplicate. */
const DUPLICATE_WINDOW_HOURS = 24;

function minutesAgoISO(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

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

  // Deterministic classification — never AI (PROJECT_CONTEXT.md §10).
  let resultKind: ResultKind = 'clear';
  if (reportCount >= 3 && distinctCategories.size >= 2) {
    resultKind = 'red';
  } else if (reportCount >= 1) {
    resultKind = 'caution';
  }

  await supabase.from('searches').insert({
    vehicle_id: vehicle?.id ?? null,
    search_term: registrationNumber,
    client_key: getClientKey(),
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
  // 1. Content rules (privacy + minimum usefulness). Mirrored server-side as CHECK
  //    constraints — this is just the friendly message.
  const contentCheck = validateDescription(params.description);
  if (!contentCheck.ok) {
    return { success: false, error: contentCheck.message };
  }

  const clientKey = getClientKey();
  const normalized = normalizeRegistration(params.registrationNumber);
  const description = params.description.trim();

  // 2. Rate limit per browser.
  const { count: recentCount } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('client_key', clientKey)
    .gte('created_at', minutesAgoISO(REPORT_WINDOW_MINUTES));

  if ((recentCount ?? 0) >= MAX_REPORTS_PER_WINDOW) {
    return {
      success: false,
      error: "You've submitted a few reports recently. Please wait a little while before adding another.",
    };
  }

  // 3. Resolve (or create) the vehicle row.
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
  } else {
    // 4. Duplicate check — same vehicle + same text in the recent window.
    const { data: recentForVehicle } = await supabase
      .from('reports')
      .select('description')
      .eq('vehicle_id', vehicleId)
      .gte('created_at', minutesAgoISO(DUPLICATE_WINDOW_HOURS * 60));

    const isDuplicate = (recentForVehicle ?? []).some(
      (r) => (r.description ?? '').trim().toLowerCase() === description.toLowerCase()
    );

    if (isDuplicate) {
      return { success: false, error: 'Looks like this report has already been submitted for this vehicle.' };
    }
  }

  const { error: reportError } = await supabase.from('reports').insert({
    vehicle_id: vehicleId,
    platform: params.platform,
    categories: params.categories,
    description,
    ride_date: params.rideDate || null,
    client_key: clientKey,
  });

  if (reportError) {
    // The server CHECK constraints can still reject content the client regex missed.
    if (reportError.message.includes('reports_description_no_contact')) {
      return {
        success: false,
        error: 'Please remove phone numbers, emails, or other contact details from the description.',
      };
    }
    if (reportError.message.includes('reports_description_min_length')) {
      return { success: false, error: 'Please add a bit more detail to the description.' };
    }
    return { success: false, error: reportError.message };
  }

  return { success: true };
}
