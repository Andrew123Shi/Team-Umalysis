import GameDataLoader from '../data/GameDataLoader';
import { deserializeFromBase64 } from '../data/RaceDataParser';
import { filterCharaSkills } from '../data/RaceDataUtils';
import { fromRaceHorseData, hydrateCompactRaceHorseData } from '../data/TrainedCharaData';
import UMDatabaseWrapper from '../data/UMDatabaseWrapper';
import { formatScore } from '../utils/formatScore';
import { normalizeSeasonValue } from '../utils/season';
import type {
    AptitudeSet,
    ParsedRaceView,
    ScoreEvent,
    ScoreBonusBreakdown,
    ScoreBonusKey,
    TTSession,
    TTRound,
    UmaEntry,
} from '../analytics/types';
import {
    buildUmaFingerprint,
    detectOpponentTrainerFromSession,
    detectPlayerIdentityFromSession,
    isRoundWinByPlacement,
} from '../analytics/umaIdentity';
import { DISTANCE_LABELS as DISTANCE_MAP } from '../analytics/types';

const RUNAWAY_TRIGGER_SKILL_ID = 202051;
const METERS_PER_LENGTH = 2.5;

function emptyScoreBonusBreakdown(): ScoreBonusBreakdown {
    return { ace: 0, opponentRating: 0, streak: 0, supportCard: 0 };
}

function scoreBonusKey(bonus: any): ScoreBonusKey | null {
    const id = Number(bonus?.score_bonus_id);
    if (id === 1) return 'ace';
    if (id === 2) return 'opponentRating';
    if (id === 8) return 'supportCard';
    if (Number(bonus?.condition_type) === 4) return 'streak';
    return null;
}

function buildScoreEvents(scoreArray: any[] | undefined): ScoreEvent[] {
    return (scoreArray ?? []).map((s: any) => {
        const score = Number(s.score);
        const bonusScores = emptyScoreBonusBreakdown();
        const bonusTotal = (s.bonus_array ?? []).reduce((sum: number, bonus: any) => {
            const bonusScore = Number(bonus.bonus_score) || 0;
            const key = scoreBonusKey(bonus);
            if (key) bonusScores[key] += bonusScore;
            return sum + bonusScore;
        }, 0);
        return {
            rawScoreId: Number(s.raw_score_id),
            num: Number(s.num),
            score,
            baseScore: score - bonusTotal,
            bonusScores,
        };
    });
}

function charaResultTeamKey(trainedCharaId: number, teamId: number): string {
    return `${trainedCharaId}:${teamId}`;
}

function buildCharaResultMaps(charaResults: any[]) {
    const byTrainedCharaIdAndTeam = new Map<string, any>();
    const byFrameOrder = new Map<number, any>();
    charaResults.forEach((charaResult: any) => {
        const trainedCharaId = Number(charaResult?.trained_chara_id);
        const teamId = Number(charaResult?.team_id);
        const frameOrder = Number(charaResult?.frame_order);
        if (Number.isFinite(trainedCharaId) && Number.isFinite(teamId)) {
            byTrainedCharaIdAndTeam.set(charaResultTeamKey(trainedCharaId, teamId), charaResult);
        }
        if (Number.isFinite(frameOrder)) byFrameOrder.set(frameOrder, charaResult);
    });
    return { byTrainedCharaIdAndTeam, byFrameOrder };
}

/** trained_chara_id is per-trainer, not unique in a race — pair with team_id. */
function resolveCharaResult(
    horse: any,
    maps: ReturnType<typeof buildCharaResultMaps>,
): any | undefined {
    const trainedCharaId = Number(horse?.trained_chara_id);
    const teamId = Number(horse?.team_id);
    const frameOrder = Number(horse?.frame_order);
    if (Number.isFinite(trainedCharaId) && Number.isFinite(teamId)) {
        const byTeam = maps.byTrainedCharaIdAndTeam.get(charaResultTeamKey(trainedCharaId, teamId));
        if (byTeam) return byTeam;
    }
    if (Number.isFinite(frameOrder) && frameOrder > 0) {
        return maps.byFrameOrder.get(frameOrder);
    }
    return undefined;
}

function isSameRaceHorse(startHorse: any, raceHorse: any): boolean {
    const trainedCharaId = Number(startHorse?.trained_chara_id);
    const teamId = Number(startHorse?.team_id);
    if (Number.isFinite(trainedCharaId) && Number.isFinite(teamId)
        && trainedCharaId === Number(raceHorse?.trained_chara_id)
        && teamId === Number(raceHorse?.team_id)) {
        return true;
    }
    const frameOrder = Number(startHorse?.frame_order);
    return Number.isFinite(frameOrder)
        && frameOrder > 0
        && frameOrder === Number(raceHorse?.frame_order);
}

function bisectFrameIndex(frames: ParsedRaceView['raceData']['frame'], time: number): number {
    if (frames.length === 0) return 0;
    const last = frames.length - 1;
    if (time <= (frames[0].time ?? 0)) return 0;
    if (time >= (frames[last].time ?? 0)) return last;

    let left = 0;
    let right = last;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if ((frames[mid].time ?? 0) < time) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return left;
}

function interpolateDistance(
    frames: ParsedRaceView['raceData']['frame'],
    frameOrder: number,
    time: number,
): number {
    if (frames.length === 0) return 0;
    const right = bisectFrameIndex(frames, time);
    const left = Math.max(0, right - 1);
    const f1 = frames[left];
    const f2 = frames[right];
    if (!f1 || !f2) return 0;

    const t1 = f1.time ?? 0;
    const t2 = f2.time ?? 0;
    const d1 = f1.horseFrame?.[frameOrder]?.distance ?? 0;
    const d2 = f2.horseFrame?.[frameOrder]?.distance ?? 0;
    if (t2 === t1) return d1;
    return d1 + (d2 - d1) * ((time - t1) / (t2 - t1));
}

function calculateRaceDistance(raceData: ParsedRaceView['raceData']): number {
    const frames = raceData.frame ?? [];
    let winnerIndex = -1;
    let winnerFinish = Number.POSITIVE_INFINITY;
    (raceData.horseResult ?? []).forEach((horseResult, index) => {
        const finish = horseResult?.finishTimeRaw;
        if (typeof finish === 'number' && finish > 0 && finish < winnerFinish) {
            winnerFinish = finish;
            winnerIndex = index;
        }
    });

    if (winnerIndex >= 0 && frames.length > 0 && Number.isFinite(winnerFinish)) {
        const frameIndex = bisectFrameIndex(frames, winnerFinish);
        const distance = frames[frameIndex]?.horseFrame?.[winnerIndex]?.distance ?? 0;
        return Math.round(distance / 100) * 100;
    }

    return raceData.header?.maxLength ?? 0;
}

function computeWinnerMarginLengths(
    raceData: ParsedRaceView['raceData'],
    raceHorseInfo: any[],
): Map<number, number> {
    const ordered = raceHorseInfo
        .map((horse) => {
            const frameOrder = Number(horse.frame_order) - 1;
            const result = Number.isFinite(frameOrder) ? raceData.horseResult?.[frameOrder] : undefined;
            return {
                trainedCharaId: Number(horse.trained_chara_id),
                frameOrder,
                finishOrder: Number(horse.finish_order),
                finishTimeRaw: result?.finishTimeRaw ?? Number(horse.finish_time ?? 0),
            };
        })
        .filter((entry) => (
            Number.isFinite(entry.trainedCharaId)
            && Number.isFinite(entry.frameOrder)
            && entry.frameOrder >= 0
            && Number.isFinite(entry.finishOrder)
        ))
        .sort((a, b) => a.finishOrder - b.finishOrder);

    const winner = ordered[0];
    const second = ordered[1];
    if (!winner || !second || winner.finishOrder !== 1 || !Number.isFinite(winner.finishTimeRaw) || winner.finishTimeRaw <= 0) {
        return new Map();
    }

    const raceDistance = calculateRaceDistance(raceData);
    if (raceDistance <= 0) return new Map();

    const secondDistanceAtWinnerFinish = interpolateDistance(raceData.frame ?? [], second.frameOrder, winner.finishTimeRaw);
    const marginMeters = Math.max(0, raceDistance - secondDistanceAtWinnerFinish);
    return new Map([[winner.trainedCharaId, marginMeters / METERS_PER_LENGTH]]);
}

function getCourseAptitudeFilters(courseId: number | undefined): { ground: number; distance: number } | null {
    if (!courseId) return null;
    const course = (GameDataLoader.courseData as Record<string, any>)[String(courseId)];
    if (!course) return null;
    const ground = course.surface as number;
    const m = course.distance as number;
    const distance = m <= 1400 ? 1 : m <= 1800 ? 2 : m <= 2400 ? 3 : 4;
    return { ground, distance };
}

function parseSessionDate(fileName: string): Date | null {
    const match = fileName.match(/^TT-(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(\d+)\.json$/i);
    if (!match) return null;
    const [, y, mo, d, h, mi, s, ms] = match;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms));
}

function resolveRunningStyle(rawStyle: number, skillIds: number[]): number {
    const learned = new Set(skillIds);
    if (rawStyle === 1 && learned.has(RUNAWAY_TRIGGER_SKILL_ID)) return 5;
    return rawStyle;
}

function buildAptitudes(horse: any): AptitudeSet {
    return {
        short: horse.proper_distance_short ?? 0,
        mile: horse.proper_distance_mile ?? 0,
        middle: horse.proper_distance_middle ?? 0,
        long: horse.proper_distance_long ?? 0,
        turf: horse.proper_ground_turf ?? 0,
        dirt: horse.proper_ground_dirt ?? 0,
        nige: horse.proper_running_style_nige ?? 0,
        senko: horse.proper_running_style_senko ?? 0,
        sashi: horse.proper_running_style_sashi ?? 0,
        oikomi: horse.proper_running_style_oikomi ?? 0,
    };
}

function extractActivatedSkills(raceData: ParsedRaceView['raceData'], frameOrder: number): number[] {
    const frameIdx = frameOrder - 1;
    if (!Number.isFinite(frameIdx) || frameIdx < 0) return [];
    return filterCharaSkills(raceData, frameIdx).map((event) => event.param[1]);
}

function buildUmaEntry(
    horse: any,
    charaResult: any,
    raceData: ParsedRaceView['raceData'],
    supportCardBonus: number,
    winMarginLengths?: number,
): UmaEntry {
    const trained = fromRaceHorseData(horse);
    const charaId = trained.charaId;
    const charaData = UMDatabaseWrapper.charas[charaId];
    const skillIds = trained.skills.map((s) => s.skillId);
    const runningStyle = resolveRunningStyle(Number(horse.running_style ?? 1), skillIds);
    const scoreEvents = buildScoreEvents(charaResult?.score_array);
    const frameOrder = Number(horse.frame_order);
    const stats = {
        speed: Number(horse.speed ?? trained.speed ?? 0),
        stamina: Number(horse.stamina ?? trained.stamina ?? 0),
        pow: Number(horse.pow ?? trained.pow ?? 0),
        guts: Number(horse.guts ?? trained.guts ?? 0),
        wiz: Number(horse.wiz ?? trained.wiz ?? 0),
    };
    const rankScore = trained.rankScore;
    const cardId = trained.cardId;
    const buildKey = buildUmaFingerprint({ stats, rankScore });
    return {
        buildKey,
        trainedCharaId: Number(horse.trained_chara_id),
        charaId,
        cardId,
        charaName: charaData?.name ?? `Unknown (${charaId})`,
        teamMemberId: Number(horse.team_member_id ?? 0),
        teamId: Number(horse.team_id ?? 0),
        trainerName: horse.trainer_name ?? 'NPC',
        supportCardBonus,
        runningStyle,
        stats,
        finalGrade: Number(horse.final_grade ?? 0),
        rankScore,
        aptitudes: buildAptitudes(horse),
        skills: trained.skills,
        finishOrder: Number(charaResult?.finish_order ?? 99),
        finishTime: Number(charaResult?.finish_time ?? 0),
        ...(winMarginLengths !== undefined ? { winMarginLengths } : {}),
        totalScore: scoreEvents.reduce((sum, e) => sum + e.score, 0),
        totalBaseScore: scoreEvents.reduce((sum, e) => sum + (e.baseScore ?? e.score), 0),
        scoreEvents,
        activatedSkillIds: extractActivatedSkills(raceData, frameOrder),
        motivation: Number(horse.motivation ?? 3),
        starCount: Math.min(5, Math.max(0, Number(horse.rarity ?? horse.talent_level ?? 0))),
    };
}

export function parseTeamTrialRace(json: any, index: number): ParsedRaceView | { error: string } {
    const start = json.race_start_params_array?.[index];
    const result = json.race_result_array?.[index];
    if (!start || !result) return { error: `Team Trial race ${index + 1} is missing start or result data` };
    if (!Array.isArray(start.race_horse_data_array)) return { error: `Team Trial race ${index + 1} has no race_horse_data_array` };
    if (typeof result.race_scenario !== 'string' || !result.race_scenario) {
        return { error: `Team Trial race ${index + 1} has no race_scenario` };
    }

    const raceData = deserializeFromBase64(result.race_scenario);
    if (!raceData) return { error: `Failed to parse Team Trial race ${index + 1} scenario data` };

    const raceInstanceId = Number(start.race_instance_id);
    const courseId = Number.isFinite(raceInstanceId)
        ? UMDatabaseWrapper.raceInstanceCourseSetId[raceInstanceId]
        : undefined;
    const courseAptitudeFilters = getCourseAptitudeFilters(courseId);
    const charaResults = Array.isArray(result.chara_result_array) ? result.chara_result_array : [];
    const charaResultMaps = buildCharaResultMaps(charaResults);

    const raceHorseInfo = start.race_horse_data_array
        .filter((horse: any) => horse !== null)
        .map((horse: any, horseIndex: number) => {
            const startFrameOrder = Number(horse?.frame_order);
            const charaResult = resolveCharaResult(horse, charaResultMaps);
            const resultFrameOrder = Number(charaResult?.frame_order);
            const frameOrder = Number.isFinite(resultFrameOrder) && resultFrameOrder > 0
                ? resultFrameOrder
                : Number.isFinite(startFrameOrder) && startFrameOrder > 0
                    ? startFrameOrder
                    : horseIndex + 1;
            return {
                ...hydrateCompactRaceHorseData(horse, { courseAptitudeFilters }),
                frame_order: frameOrder,
                finish_order: charaResult?.finish_order,
                finish_time: charaResult?.finish_time,
                team_score_array: charaResult?.score_array,
                team_id: horse.team_id,
            };
        })
        .filter((horse: any) => {
            const frameOrder = Number(horse?.frame_order);
            return Number.isFinite(frameOrder) && frameOrder >= 1 && frameOrder <= raceData.horseResult.length;
        })
        .sort((a: any, b: any) => Number(a.frame_order) - Number(b.frame_order));

    if (raceHorseInfo.length === 0) {
        return { error: `Team Trial race ${index + 1} did not include any runners matching the replay data` };
    }

    const round = Number(result.round ?? start.round ?? index + 1);
    const teamTotalScore = Number(result.team_total_score);
    const scoreLabel = Number.isFinite(teamTotalScore) ? ` - ${formatScore(teamTotalScore)} pts` : '';
    const label = `Race ${Number.isFinite(round) ? round : index + 1}${scoreLabel}`;

    return {
        label,
        raceHorseInfo,
        raceData,
        raceScenario: result.race_scenario,
        detectedCourseId: courseId,
        horseActVersion: json.horseACT_version,
        raceType: 'Team Trials',
        trackDetails: {
            condition: start.ground_condition?.toString(),
            weather: start.weather?.toString(),
            season: normalizeSeasonValue(start.season)?.toString(),
        },
        round: Number.isFinite(round) ? round : index + 1,
        teamTotalScore: Number.isFinite(teamTotalScore) ? teamTotalScore : undefined,
        winType: typeof result.win_type === 'number' ? result.win_type : undefined,
    };
}

export function parseTeamTrialSession(json: any, fileName: string): TTSession | { error: string } {
    const starts = json.race_start_params_array;
    const results = json.race_result_array;
    if (!Array.isArray(starts) || !Array.isArray(results)) {
        return { error: 'Could not find Team Trial race_start_params_array or race_result_array' };
    }

    const id = fileName.replace(/\.json$/i, '');
    const count = Math.min(starts.length, results.length);
    const rounds: TTRound[] = [];
    const playerIdentity = detectPlayerIdentityFromSession(starts);
    const opponentTeamId = playerIdentity.teamId === 1 ? 2 : 1;

    for (let index = 0; index < count; index++) {
        const parsed = parseTeamTrialRace(json, index);
        if ('error' in parsed) return parsed;

        const start = starts[index];
        const result = results[index];
        const horses = start.race_horse_data_array ?? [];
        const charaResults = result.chara_result_array ?? [];
        const charaResultMaps = buildCharaResultMaps(charaResults);
        const winMarginsByTrainedCharaId = computeWinnerMarginLengths(parsed.raceData, parsed.raceHorseInfo);

        const playerUmas: UmaEntry[] = [];
        const opponentUmas: UmaEntry[] = [];
        const npcUmas: UmaEntry[] = [];

        horses.forEach((horse: any) => {
            const hydrated = parsed.raceHorseInfo.find((h: any) => isSameRaceHorse(horse, h)) ?? horse;
            const charaResult = resolveCharaResult(horse, charaResultMaps);
            const entry = buildUmaEntry(
                hydrated,
                charaResult,
                parsed.raceData,
                Number(json.support_card_bonus ?? 0),
                winMarginsByTrainedCharaId.get(Number(horse.trained_chara_id)),
            );
            if (entry.teamId === playerIdentity.teamId) playerUmas.push(entry);
            else if (entry.teamId === opponentTeamId) opponentUmas.push(entry);
            else npcUmas.push(entry);
        });

        rounds.push({
            round: parsed.round,
            distanceType: Number(result.distance_type ?? index + 1),
            distanceLabel: DISTANCE_MAP[Number(result.distance_type)] ?? 'Unknown',
            raceInstanceId: Number(start.race_instance_id),
            courseId: parsed.detectedCourseId,
            selfEvaluate: Number(start.self_evaluate ?? 0),
            opponentEvaluate: Number(start.opponent_evaluate ?? 0),
            supportCardBonus: Number(json.support_card_bonus ?? 0),
            teamTotalScore: Number(result.team_total_score ?? 0),
            teamScoreEvents: buildScoreEvents(result.team_score_array),
            winType: Number(result.win_type ?? 0),
            consecutiveWins: Number(result.current_consecutive_win_count ?? 0),
            playerUmas,
            opponentUmas,
            npcUmas,
            parsedRace: parsed,
            playerWonRound: isRoundWinByPlacement(playerUmas, opponentUmas),
        });
    }

    return {
        id,
        fileName,
        savedAt: parseSessionDate(fileName),
        playerTeamId: playerIdentity.teamId,
        playerTrainerName: playerIdentity.trainerName,
        opponentTrainerName: detectOpponentTrainerFromSession(starts, playerIdentity),
        supportCardBonus: Number(json.support_card_bonus ?? 0),
        rounds,
    };
}

export function isTeamTrialJson(json: any): boolean {
    return Array.isArray(json?.race_start_params_array) && Array.isArray(json?.race_result_array);
}
