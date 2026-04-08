/**
 * Custom hooks for Analytics API
 * Use with SWR for caching and automatic revalidation
 */

import useSWR from 'swr';

const ADMIN_API_BASE = '/api/congrats-secure';

/**
 * Get development headers
 */
function getDevHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  // In development, automatically add admin email
  if (process.env.NODE_ENV === 'development') {
    // Try to get email from localStorage or use a default value
    const devEmail = typeof window !== 'undefined'
      ? localStorage.getItem('dev-admin-email') || process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL
      : process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL;

    if (devEmail) {
      headers['X-Dev-Admin-Email'] = devEmail;
    }
  }

  return headers;
}

/**
 * Fetcher with error handling
 */
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: getDevHeaders()
  });

  if (!res.ok) {
    const error: any = new Error('API error');
    error.status = res.status;
    error.info = await res.json();
    throw error;
  }

  return res.json();
}

/**
 * Hook to get conversion funnel data
 */
export function useAnalyticsFunnel(days: number = 30) {
  const { data, error, isLoading, mutate } = useSWR(
    `${ADMIN_API_BASE}/analytics/funnel?days=${days}`,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutos
      revalidateOnFocus: false
    }
  );

  return {
    data,
    isLoading,
    isError: error,
    refresh: mutate
  };
}

/**
 * Hook to get landing page analytics
 */
export function useAnalyticsLanding(days: number = 30) {
  const { data, error, isLoading, mutate } = useSWR(
    `${ADMIN_API_BASE}/analytics/landing?days=${days}`,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutos
      revalidateOnFocus: false
    }
  );

  return {
    data,
    isLoading,
    isError: error,
    refresh: mutate
  };
}

/**
 * Hook to get conversion and monetization analytics
 */
export function useAnalyticsConversion(days: number = 30) {
  const { data, error, isLoading, mutate } = useSWR(
    `${ADMIN_API_BASE}/analytics/conversion?days=${days}`,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutos
      revalidateOnFocus: false
    }
  );

  return {
    data,
    isLoading,
    isError: error,
    refresh: mutate
  };
}

/**
 * Hook to get analytics for a specific user
 */
export function useUserAnalytics(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `${ADMIN_API_BASE}/analytics/users/${userId}` : null,
    fetcher,
    {
      refreshInterval: 60000, // 1 minuto
      revalidateOnFocus: true
    }
  );

  return {
    data,
    isLoading,
    isError: error,
    refresh: mutate
  };
}
