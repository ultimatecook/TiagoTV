/**
 * A 0–10 rating as the "% Match" the Home shows (8.2 → 82). Ratings on
 * another scale, or unreadable ones, give null and keep their own form.
 */
export function ratingMatchPercent(
    rating: string | number | null | undefined
): number | null {
    if (rating === null || rating === undefined || rating === '') {
        return null;
    }
    const value = typeof rating === 'number' ? rating : parseFloat(rating);
    if (!Number.isFinite(value) || value <= 0 || value > 10) {
        return null;
    }
    return Math.round(value * 10);
}

/** "Drama, Crime / Mystery" → ["Drama", "Crime", "Mystery"], at most `max`. */
export function splitCatalogGenres(
    genre: string | null | undefined,
    max = 3
): string[] {
    return (genre ?? '')
        .split(/[,/|]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, max);
}
