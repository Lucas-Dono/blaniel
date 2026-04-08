/**
 * SWR Global Configuration
 *
 * Configura SWR (stale-while-revalidate) para toda la aplicación:
 * - Fetcher global con manejo de errores
 * - Revalidación en foco
 * - Retry automático
 * - Deduplicación de requests
 */

"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

/**
 * Fetcher global para SWR
 * Maneja responses JSON y errores HTTP
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error: any = new Error("An error occurred while fetching the data.");
    error.info = await res.json().catch(() => ({}));
    error.status = res.status;
    throw error;
  }

  return res.json();
};

interface SWRProviderProps {
  children: ReactNode;
}

/**
 * Provider global de SWR con configuración optimizada
 *
 * Configuración:
 * - Revalidación automática al enfocar ventana (útil para tabs)
 * - Retry 3 veces con backoff exponencial
 * - Deduplicación de requests en 2s
 * - Refreshinterval deshabilitado (solo on-demand)
 */
export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true, // Revalidar al volver a la tab
        revalidateOnReconnect: true, // Revalidar al reconectar internet
        dedupingInterval: 2000, // Deduplica requests en 2s
        errorRetryCount: 3, // Retry hasta 3 veces
        errorRetryInterval: 1000, // 1s entre retries
        shouldRetryOnError: true,
        // NO revalidar automáticamente por tiempo (solo manual o on-focus)
        refreshInterval: 0,
        // Mantener data anterior mientras revalida (stale-while-revalidate)
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}

/**
 * Helper para mutar data manualmente
 * Útil después de POST/PUT/DELETE
 *
 * @example
 * import { mutate } from 'swr'
 *
 * // After creating behavior:
 * await mutate('/api/agents/123/behaviors')
 *
 * // Optimistic update:
 * mutate('/api/agents/123/behaviors', newData, false)
 */
