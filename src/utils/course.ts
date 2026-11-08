import GameDataLoader from '../data/GameDataLoader';

type CourseRecord = {
    raceTrackId: number;
    surface: number;
    distance: number;
    course?: number;
    turn?: number;
};

const SURFACE_LABELS: Record<number, string> = { 1: 'Turf', 2: 'Dirt' };

export type CourseTurn = 'left' | 'right' | 'straight';

function getCourseRecord(courseId: number | undefined): CourseRecord | null {
    if (!courseId) return null;
    const course = (GameDataLoader.courseData as Record<string, CourseRecord>)[String(courseId)];
    return course ?? null;
}

function trackName(raceTrackId: number): string {
    return (GameDataLoader.tracknames as Record<string, string[]>)[raceTrackId]?.[1] ?? 'Unknown';
}

/** Team Trials treat multiples of 400m as standard distance. */
export function isStandardDistance(distanceMeters: number): boolean {
    return distanceMeters > 0 && distanceMeters % 400 === 0;
}

export function getCourseRaceTrackId(courseId: number | undefined): number | null {
    return getCourseRecord(courseId)?.raceTrackId ?? null;
}

export function getTrackLocationName(courseId: number | undefined): string | null {
    const course = getCourseRecord(courseId);
    if (!course) return null;
    return trackName(course.raceTrackId);
}

export function getCourseDistanceMeters(courseId: number | undefined): number | null {
    const distance = getCourseRecord(courseId)?.distance;
    return distance && distance > 0 ? distance : null;
}

/** race_course_set.turn, the same value skills check as `rotation`: 1 = right, 2 = left, 4 = straight. */
export function getCourseTurn(courseId: number | undefined): CourseTurn | null {
    switch (getCourseRecord(courseId)?.turn) {
        case 1: return 'right';
        case 2: return 'left';
        case 4: return 'straight';
        default: return null;
    }
}

export function getCourseDisplayName(courseId: number | undefined): string | null {
    const course = getCourseRecord(courseId);
    if (!course) return courseId ? `Course ${courseId}` : null;
    const surface = SURFACE_LABELS[course.surface] ?? 'Unknown';
    const suffix = course.course === 2 ? ' (inner)' : course.course === 3 ? ' (outer)' : '';
    return `${trackName(course.raceTrackId)} ${surface} ${course.distance}m${suffix}`;
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
