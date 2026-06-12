import type { RaceSimulateData } from '../data/race_data_pb';

export const DISTANCE_LABELS: Record<number, string> = {
    1: 'Sprint',
    2: 'Mile',
    3: 'Medium',
    4: 'Long',
    5: 'Dirt',
};

export const DISTANCE_ORDER = [1, 2, 3, 4, 5] as const;

export const STRATEGY_LABELS: Record<number, string> = {
    1: 'Front/Runaway',
    2: 'Pace Chaser',
    3: 'Late Surger',
    4: 'End Closer',
    5: 'Front/Runaway',
};

export type SkillRef = { skillId: number; level: number };

export type ScoreEvent = {
    rawScoreId: number;
    num: number;
    score: number;
    /** Base score before ace / opponent / support bonuses. */
    baseScore: number;
};

export type ScoreBreakdownSummary = {
    raceCount: number;
    avgFinishOrder: number;
    avgFinishPositionScore: number;
    avgWinMarginLengths: number;
    avgWinMarginBonus: number;
    /** 1st-place finishes included in win-margin stats. */
    winMarginWinCount: number;
    /** Wins with a replay-derived margin in lengths. */
    winMarginLengthCount: number;
    goodMidPositionRate: number;
    avgGoodMidPositionBonus: number;
    goodLatePositionRate: number;
    avgGoodLatePositionBonus: number;
    strongStartRate: number;
    avgStrongStartBonus: number;
    avgRegularSkillActivations: number;
    regularSkillActivationRate: number;
    avgRegularSkillPoints: number;
    avgGoldSkillActivations: number;
    goldSkillActivationRate: number;
    avgGoldSkillPoints: number;
    avgUniqueSkillActivations: number;
    uniqueSkillActivationRate: number;
    avgUniqueSkillPoints: number;
    beatTargetTimeRate: number;
    avgBeatTargetTimeBonus: number;
    rushedOccurrenceRate: number;
    avgRushedPenalty: number;
    avgRushedDurationSeconds: number;
    avgRushedDurationPenalty: number;
    rushedDurationCount: number;
};

export type AptitudeSet = {
    short: number;
    mile: number;
    middle: number;
    long: number;
    turf: number;
    dirt: number;
    nige: number;
    senko: number;
    sashi: number;
    oikomi: number;
};

export type UmaEntry = {
    buildKey: string;
    trainedCharaId: number;
    charaId: number;
    cardId: number;
    charaName: string;
    teamMemberId: number;
    teamId: number;
    trainerName: string;
    runningStyle: number;
    stats: { speed: number; stamina: number; pow: number; guts: number; wiz: number };
    finalGrade: number;
    rankScore: number;
    aptitudes: AptitudeSet;
    skills: SkillRef[];
    finishOrder: number;
    finishTime: number;
    winMarginLengths?: number;
    totalScore: number;
    scoreEvents: ScoreEvent[];
    activatedSkillIds: number[];
    motivation: number;
    starCount: number;
};

export type ParsedRaceView = {
    label: string;
    raceHorseInfo: any[];
    raceData: RaceSimulateData;
    raceScenario: string;
    detectedCourseId?: number;
    horseActVersion?: string;
    raceType: string;
    trackDetails?: { condition?: string; weather?: string; season?: string };
    round: number;
    teamTotalScore?: number;
    winType?: number;
};

export type TTRound = {
    round: number;
    distanceType: number;
    distanceLabel: string;
    raceInstanceId: number;
    courseId?: number;
    selfEvaluate: number;
    opponentEvaluate: number;
    teamTotalScore: number;
    winType: number;
    consecutiveWins: number;
    playerUmas: UmaEntry[];
    opponentUmas: UmaEntry[];
    npcUmas: UmaEntry[];
    parsedRace: ParsedRaceView;
    playerWonRound: boolean;
};

export type TTSession = {
    id: string;
    fileName: string;
    savedAt: Date | null;
    playerTeamId: number;
    playerTrainerName: string;
    opponentTrainerName: string;
    supportCardBonus: number;
    rounds: TTRound[];
};

export type SessionIndexEntry = {
    id: string;
    fileName: string;
    savedAt: string | null;
    playerTrainerName: string;
    opponentTrainerName: string;
    supportCardBonus: number;
    totalTeamScore: number;
    roundsWon: number;
    roundCount: number;
    opponentEvaluate: number;
};

export type NumericSummary = {
    count: number;
    avg: number;
    median: number;
    min: number;
    max: number;
};

export type StyleComposition = {
    front: number;
    pace: number;
    late: number;
    end: number;
};

export type MatchupEntry = {
    charaId: number;
    cardId: number;
    charaName: string;
    displayName: string;
    appearances: number;
    avgPlacement: number;
    winRate: number;
    occurrenceRate: number;
    avgNormalizedScore: number;
};

export type TrackMatchupEntry = {
    courseId: number;
    displayName: string;
    appearances: number;
    avgPlacement: number;
    winRate: number;
    occurrenceRate: number;
    avgNormalizedScore: number;
};

export type StyleMatchupEntry = {
    key: string;
    label: string;
    composition: StyleComposition;
    appearances: number;
    avgPlacement: number;
    wins: number;
    winRate: number;
};

export type StyleSaturationPoint = {
    count: number;
    winRate: number;
    races: number;
};

export type StyleSaturationSeries = {
    styleId: number;
    label: string;
    points: StyleSaturationPoint[];
};

export type StyleSaturationData = StyleSaturationSeries[];

export type SkillFrequencyEntry = {
    skillId: number;
    skillName: string;
    activated: number;
    learned: number;
    activationRate: number;
    prevalenceRate: number;
    isGold: boolean;
};

export type OpponentStatSummary = {
    speed: NumericSummary;
    stamina: NumericSummary;
    pow: NumericSummary;
    guts: NumericSummary;
    wiz: NumericSummary;
    rankScore: NumericSummary;
    teamRating: NumericSummary;
    finalGrade: NumericSummary;
};

export type RosterChangeUma = {
    buildKey: string;
    charaName: string;
    cardId: number;
    rankScore: number;
};

export type RosterUpdate = {
    added: RosterChangeUma[];
    removed: RosterChangeUma[];
};

export type ScoreTrendPoint = {
    date: string;
    teamScore: number;
    supportCardBonus: number;
    selfTeamRating: number;
    opponentTeamRating: number;
    rosterUpdate?: RosterUpdate;
};

export type AggregatedStats = {
    totalRounds: number;
    totalSessions: number;
    playerRoundWins: number;
    sessionWinRate: number;
    placement: NumericSummary;
    score: NumericSummary;
    raceScoreTotal: NumericSummary;
    teamScore: NumericSummary;
    winRate: number;
    top2Rate: number;
    top3Rate: number;
    roundWinRate: number;
    roundTop2Rate: number;
    roundTop3Rate: number;
    opponentStyleComposition: StyleComposition;
    npcStyleComposition: StyleComposition;
    roomStyleComposition: StyleComposition;
    npcStyleCompositionAvgCount: StyleComposition;
    roomStyleCompositionAvgCount: StyleComposition;
    opponentStats: OpponentStatSummary;
    npcStats: OpponentStatSummary;
    opponentAptitudes: Record<string, NumericSummary>;
    npcAptitudes: Record<string, NumericSummary>;
    opponentSkills: SkillFrequencyEntry[];
    playerSkillActivations: SkillFrequencyEntry[];
    avgGoldActivations: number;
    avgWhiteActivations: number;
    goldActivations: NumericSummary;
    whiteActivations: NumericSummary;
    matchups: MatchupEntry[];
    trackMatchups: TrackMatchupEntry[];
    styleMatchups: StyleMatchupEntry[];
    styleSaturation: StyleSaturationData | null;
    scoreTrend: ScoreTrendPoint[];
    opponentRatingBuckets: { bucket: string; appearances: number; avgPlacement: number; winRate: number }[];
    distanceWinRates: { distance: string; appearances: number; winRate: number; avgScore: number }[];
    playerUmas: PlayerUmaSummary[];
    scoreBreakdown: ScoreBreakdownSummary | null;
};

export type PlayerUmaSummary = {
    buildKey: string;
    charaId: number;
    cardId: number;
    charaName: string;
    rankScore: number;
    stats: UmaEntry['stats'];
    appearances: number;
    winRate: number;
    avgPlacement: number;
    avgScore: number;
    placement: NumericSummary;
    score: NumericSummary;
};

export type RosterUmaSlot = PlayerUmaSummary & {
    teamMemberId: number;
    distanceType: number;
    runningStyle: number;
    starCount: number;
    totalSkillPoints: number;
};

export type UmaComparisonEntry = {
    buildKey: string;
    charaId: number;
    cardId: number;
    charaName: string;
    rankScore: number;
    stats: UmaEntry['stats'];
    appearances: number;
    wins: number;
    winRate: number;
    avgNormalizedScore: number;
    distanceType: number;
    lastSeenAt: number | null;
    scoreBreakdown: ScoreBreakdownSummary;
    avgGoldSkillActivations: number;
    avgRegularSkillActivations: number;
    avgUniqueSkillActivations: number;
    totalGoldSkillActivations: number;
    totalRegularSkillActivations: number;
    totalUniqueSkillActivations: number;
    totalGoldSkillChances: number;
    totalRegularSkillChances: number;
    totalUniqueSkillChances: number;
};
