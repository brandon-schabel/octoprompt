/**
 * Safely parses a timestamp value from various common formats into a Date object.
 * Handles numbers (Unix timestamp in seconds or milliseconds),
 * ISO 8601 strings, and common SQL timestamp formats.
 * @param tsValue - The timestamp value to parse (number, string, null, or undefined).
 * @returns A Date object if parsing is successful, otherwise null.
 */
export const parseTimestamp = (tsValue: unknown): Date | null => {
    if (tsValue === null || tsValue === undefined) {
        return null;
    }

    if (typeof tsValue === 'number') {
        if (isNaN(tsValue)) return null;
        // Crude check: If the number is very large, assume milliseconds, otherwise seconds.
        // A more robust check might involve looking at the number of digits or a specific date range.
        const date = new Date(tsValue > 100000000000 ? tsValue : tsValue * 1000);
        return !isNaN(date.getTime()) ? date : null;
    }

    if (typeof tsValue === 'string') {
        const trimmedValue = tsValue.trim();
        if (!trimmedValue) return null;

        // Attempt parsing common formats. Date constructor handles ISO 8601 well.
        // It can also handle formats like 'YYYY-MM-DD HH:MM:SS' but might be locale-dependent.
        const date = new Date(trimmedValue);

        // Verify the parsed date is valid
        if (!isNaN(date.getTime())) {
            // Additional check for strings that might parse but are invalid (e.g., "not a date")
            // This relies on the Date object's toString() behavior for invalid dates.
            if (date.toString() !== 'Invalid Date') {
                 // Double-check for SQL-like format ambiguity if needed,
                 // e.g., by ensuring parts match expected patterns if Date parsing is unreliable.
                 // For now, trust the Date constructor if it yields a valid time.
                return date;
            }
        }
    }

    return null;
};


export const normalizeToIsoString = (tsValue: unknown): string | null => {
    //  first parse the timestamp
    const date = parseTimestamp(tsValue);
    // then return the ISO string
    return date ? date.toISOString() : null;
};
