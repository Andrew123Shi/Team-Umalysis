import GameDataLoader from '../data/GameDataLoader';

type CourseRecord = { raceTrackId: number; surface: number; distance: number; course?: number };

const SURFACE_LABELS: Record<number, string> = { 1: 'Turf', 2: 'Dirt' };

function getCourseRecord(courseId: number | undefined): CourseRecord | null {
    if (!courseId) return null;
    const course = (GameDataLoader.courseData as Record<string, CourseRecord>)[String(courseId)];
    return course ?? null;
}

export function getCourseDisplayName(courseId: number | undefined): string | null {
    const course = getCourseRecord(courseId);
    if (!course) return courseId ? `Course ${courseId}` : null;
    const trackName = (GameDataLoader.tracknames as Record<string, string[]>)[course.raceTrackId]?.[1] ?? 'Unknown';
    const surface = SURFACE_LABELS[course.surface] ?? 'Unknown';
    const suffix = course.course === 2 ? ' (inner)' : course.course === 3 ? ' (outer)' : '';
    return `${trackName} ${surface} ${course.distance}m${suffix}`;
}

export function getCourseAptitudeFilters(courseId: number | undefined): { ground: number; distance: number } | null {
    if (!courseId) return null;
    const course = (GameDataLoader.courseData as Record<string, any>)[String(courseId)];
    if (!course) return null;
    const ground = course.surface as number;
    const m = course.distance as number;
    const distance = m <= 1400 ? 1 : m <= 1800 ? 2 : m <= 2400 ? 3 : 4;
    return { ground, distance };
}
