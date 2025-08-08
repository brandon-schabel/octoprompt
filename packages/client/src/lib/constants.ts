// Time constants (in milliseconds)
export const TICKETS_STALE_TIME = 30 * 1000 // 30 seconds
export const QUEUE_REFETCH_INTERVAL = 5000 // 5 seconds
export const RETRY_MAX_ATTEMPTS = 2
export const RETRY_MAX_DELAY = 30000 // 30 seconds

// UI constants
export const TICKET_LIST_MIN_WIDTH = 300
export const TICKET_LIST_MAX_WIDTH = 400
export const QUEUE_SIDEBAR_WIDTH = 64
export const FLOW_SIDEBAR_WIDTH = 256

// Queue constants
export const MAX_PARALLEL_ITEMS_DEFAULT = 1
export const MAX_PARALLEL_ITEMS_MAX = 10
export const QUEUE_PRIORITY_DEFAULT = 0

// Drag and drop constants
export const DRAG_OVERLAY_OPACITY = 0.5
export const DRAG_ANIMATION_DURATION = 200

// Error messages
export const GENERIC_ERROR_MESSAGE = 'An error occurred. Please try again.'
export const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection.'
export const NOT_FOUND_ERROR_MESSAGE = 'The requested resource was not found.'
