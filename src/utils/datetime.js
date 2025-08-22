export function utcNow() {
    return new Date();
}
export function parseDbDate(dateStr) {
    if (!dateStr)
        return null;
    if (dateStr instanceof Date)
        return dateStr;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime()))
            return null;
        return date;
    }
    catch {
        return null;
    }
}
export function formatDateForDb(date) {
    return date.toISOString();
}
export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
export function subtractDays(date, days) {
    return addDays(date, -days);
}
export function isBefore(date1, date2) {
    return date1.getTime() < date2.getTime();
}
export function isAfter(date1, date2) {
    return date1.getTime() > date2.getTime();
}
export function isSameDay(date1, date2) {
    return (date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate());
}
export function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}
export function endOfDay(date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}
//# sourceMappingURL=datetime.js.map