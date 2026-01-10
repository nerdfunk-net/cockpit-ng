import {
  isServer,
  QueryClient,
  QueryCache,
  MutationCache,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query'

// Toast integration (using existing Shadcn toast)
let toastFunction: ((options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void) | null = null

export function setToastFunction(toast: typeof toastFunction) {
  toastFunction = toast
}

function makeQueryClient() {
  return new QueryClient({
    // Global query error handling
    queryCache: new QueryCache({
      onError: (error) => {
        // Skip auth errors (useApi handles logout/redirect)
        if (error instanceof Error &&
            (error.message.includes('Session expired') ||
             error.message.includes('401'))) {
          return
        }

        // Show toast for unexpected errors
        if (toastFunction) {
          toastFunction({
            title: 'Error loading data',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive'
          })
        }
      }
    }),

    // Global mutation error handling
    mutationCache: new MutationCache({
      onError: (error) => {
        // Skip auth errors
        if (error instanceof Error &&
            (error.message.includes('Session expired') ||
             error.message.includes('401'))) {
          return
        }

        // Show toast (can be overridden by onError in specific mutations)
        if (toastFunction) {
          toastFunction({
            title: 'Operation failed',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive'
          })
        }
      }
    }),

    defaultOptions: {
      queries: {
        // Consider data fresh for 30 seconds
        staleTime: 30 * 1000,

        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,

        // CRITICAL: Enable for network monitoring dashboard
        // Users frequently switch between Cockpit and CLI/SSH
        // staleTime prevents excessive requests
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,

        // Custom retry logic
        retry: (failureCount, error) => {
          // CRITICAL: Never retry auth errors
          // Prevents infinite loops when token expires
          if (error instanceof Error) {
            if (error.message.includes('401') ||
                error.message.includes('403') ||
                error.message.includes('Session expired')) {
              return false
            }
          }
          // Retry other errors once
          return failureCount < 1
        },
      },

      mutations: {
        // Don't retry mutations by default (idempotency concerns)
        retry: false,
      },

      dehydrate: {
        // Include pending queries in SSR/hydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  })
}

// Singleton pattern for client-side
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client (no data leaking between requests)
    return makeQueryClient()
  } else {
    // Browser: create singleton (important for React suspense)
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}
