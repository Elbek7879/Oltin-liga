/*
 * Namunaviy ma'lumotlar generatori. Barcha jamoa, futbolchi va homiy nomlari
 * o'ylab topilgan — haqiqiy shaxs yoki tashkilotlarga aloqasi yo'q.
 * Tasodifiy sonlar "seed" bilan olinadi, shuning uchun natijalar har safar bir xil.
 */
import { seededRandom, shuffle } from "@/domain/draw"
import { createBracket, playoffPlan, qualifiersFor, advancementUpdates } from "@/domain/playoff"
import { addDays, roundRobin, toLocalIso } from "@/domain/schedule"
import { computeStandings } from "@/domain/standings"
import { computePlayerStats, computeTeamDiscipline, topScorers } from "@/domain/stats"
import type {
  Appearance,
  EventType,
  Group,
  ID,
  Match,
  MatchEvent,
  Player,
  Position,
  RosterEntry,
  Season,
  SeasonAward,
  SeasonTeam,
  Team,
} from "@/domain/types"
import { todayKey } from "@/lib/format"
import { defaultSeasonRules as defaultRules } from "../defaults"
import { DB_VERSION, type LeagueDb } from "./db"

const TEAM_DEFS: [string, string, string, string, string, number][] = [
  ["Navbahor", "NAV", "Payariq", "#145A3A", "#E2BF4F", 1998],
  ["Do‘stlik", "DOS", "Chelak", "#1D4E89", "#FFFFFF", 2004],
  ["Lochin", "LOC", "Oqtepa", "#8C2F39", "#F6E7C1", 2010],
  ["Yulduz", "YUL", "Qo‘shtepa", "#14213D", "#FCA311", 2008],
  ["Chinor", "CHI", "Toshloq", "#3A5A40", "#E9EDE3", 2012],
  ["Burgut", "BUR", "Mirzaariq", "#5C3D2E", "#F2E8CF", 2015],
  ["Zarafshon", "ZAR", "Yangiobod", "#0B6E99", "#F1F7FA", 2006],
  ["Shalola", "SHA", "Ko‘kdala", "#A23B72", "#FFFFFF", 2017],
  ["Mehnat", "MEH", "Bog‘ishamol", "#6B4E16", "#F9E79F", 2001],
  ["Tulpor", "TUL", "Sarbozor", "#2B2D42", "#EDF2F4", 2019],
  ["Bahor", "BAH", "Navro‘z", "#2D6A4F", "#FFFFFF", 2013],
  ["Ittifoq", "ITT", "Do‘rmon", "#9D0208", "#FFD166", 2009],
  ["Oltin Soy", "OLS", "Soybo‘yi", "#7F5539", "#FFE8A3", 2020],
  ["Guliston", "GUL", "Guliston", "#386641", "#F2E8CF", 2011],
  ["Sharq", "SHQ", "Sharqobod", "#1B4965", "#CAE9FF", 2016],
  ["Olmazor", "OLM", "Olmazor", "#4A4E69", "#F2E9E4", 2018],
]

const STRENGTH = [1.35, 1.25, 1.15, 1.1, 1.0, 0.95, 1.05, 0.9, 1.0, 0.85, 1.1, 0.95, 0.8, 1.0, 0.9, 0.85]

const FIRST_NAMES = [
  "Abdulla", "Akmal", "Alisher", "Anvar", "Asilbek", "Bahodir", "Bekzod", "Bobur", "Doniyor", "Elyor",
  "Farhod", "Firdavs", "Husan", "Islom", "Javohir", "Jasur", "Jahongir", "Kamron", "Komil", "Mirjalol",
  "Muhammadali", "Nodir", "Odil", "Otabek", "Rustam", "Sardor", "Sherzod", "Shohruh", "Temur", "Ulug‘bek",
  "Umid", "Xurshid", "Zafar", "Zohid", "Azizbek", "Behruz", "Dilshod", "Eldor", "G‘ayrat", "Ilhom",
]

const LAST_NAMES = [
  "Abdullayev", "Aliyev", "Boboyev", "Ergashev", "Ibragimov", "Jo‘rayev", "Karimov", "Mamatov", "Murodov",
  "Nazarov", "Normatov", "Ochilov", "Qodirov", "Rahimov", "Saidov", "Salimov", "Tursunov", "Usmonov",
  "Xolmatov", "Yusupov", "Zokirov", "Hamroyev", "Shukurov", "Eshonqulov", "Sobirov", "To‘xtayev",
]

const REFEREES = ["Baxtiyor Qosimov", "Sanjar Rashidov", "Ravshan Olimov", "Akbar Toshev", "Shuhrat Islomov"]

const ROSTER_SHAPE: Position[] = ["GK", "GK", "DF", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW", "FW"]

export function createSeed(now: Date = new Date()): LeagueDb {
  const rnd = seededRandom(20260415)
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)]
  let counter = 0
  const id = (prefix: string) => `${prefix}${++counter}`

  const today = todayKey(now)

  // Ligadagi barcha o'yinlar bitta stadionda o'tadi
  const venues = [{ id: "v1", name: "Mirzacho‘l Birlik Arena", village: "" }]

  const teams: Team[] = TEAM_DEFS.map(([name, short, village, primary, secondary, founded], i) => ({
    id: `t${i + 1}`,
    name,
    shortName: short,
    village,
    primaryColor: primary,
    secondaryColor: secondary,
    founded,
    active: true,
  }))
  const strengthOf = new Map(teams.map((t, i) => [t.id, STRENGTH[i]]))

  // Futbolchilar: har bir jamoada 15 kishi
  const players: Player[] = []
  const playersByTeam = new Map<ID, Player[]>()
  const usedNames = new Set<string>()
  for (const team of teams) {
    const list: Player[] = []
    for (const position of ROSTER_SHAPE) {
      let first = pick(FIRST_NAMES)
      let last = pick(LAST_NAMES)
      while (usedNames.has(`${first} ${last}`)) {
        first = pick(FIRST_NAMES)
        last = pick(LAST_NAMES)
      }
      usedNames.add(`${first} ${last}`)
      const p: Player = {
        id: id("p"),
        firstName: first,
        lastName: last,
        birthYear: 1990 + Math.floor(rnd() * 16),
        position,
        phone: `+998 9${Math.floor(rnd() * 10)} ${String(Math.floor(rnd() * 900) + 100)} ${String(Math.floor(rnd() * 90) + 10)} ${String(Math.floor(rnd() * 90) + 10)}`,
      }
      list.push(p)
      players.push(p)
    }
    playersByTeam.set(team.id, list)
  }

  const seasons: Season[] = []
  const seasonTeams: SeasonTeam[] = []
  const rosters: RosterEntry[] = []
  const groups: Group[] = []
  const matches: Match[] = []
  const events: MatchEvent[] = []
  const appearances: Appearance[] = []
  const awards: SeasonAward[] = []

  const rosterOf = new Map<ID, Player[]>()

  const addSeasonTeams = (season: Season, teamList: Team[], rosterFor: (team: Team) => Player[]) => {
    const result: SeasonTeam[] = []
    for (const team of teamList) {
      const st: SeasonTeam = {
        id: `st-${season.year}-${team.id}`,
        seasonId: season.id,
        teamId: team.id,
        name: team.name,
        shortName: team.shortName,
        coach: rnd() > 0.35 ? `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` : undefined,
      }
      const squad = rosterFor(team)
      const numbers = shuffle(Array.from({ length: 30 }, (_, i) => i + 1), rnd)
      squad.forEach((p, i) => {
        const number = p.position === "GK" && i === 0 ? 1 : numbers[i] === 1 ? 31 : numbers[i]
        rosters.push({ id: id("r"), seasonId: season.id, seasonTeamId: st.id, playerId: p.id, number })
      })
      const captain = squad.find((p) => p.position === "MF") ?? squad[0]
      st.captainId = captain.id
      rosterOf.set(st.id, squad)
      seasonTeams.push(st)
      result.push(st)
    }
    return result
  }

  const teamStrength = (seasonTeamId: ID) => strengthOf.get(seasonTeams.find((s) => s.id === seasonTeamId)!.teamId) ?? 1

  // Puasson taqsimoti bo'yicha gollar soni (kuchliroq jamoa ko'proq gol uradi)
  const goalsFor = (strength: number, opponent: number) => {
    const limit = Math.exp(-1.35 * (strength / opponent))
    let k = 0
    let p = rnd()
    while (p > limit && k < 6) {
      k++
      p *= rnd()
    }
    return k
  }

  const weightedScorer = (squad: Player[], exclude?: ID) => {
    const weights: number[] = squad.map((p) => (p.id === exclude ? 0 : p.position === "FW" ? 6 : p.position === "MF" ? 3 : p.position === "DF" ? 1 : 0))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = rnd() * total
    for (let i = 0; i < squad.length; i++) {
      r -= weights[i]
      if (r <= 0 && weights[i] > 0) return squad[i]
    }
    return squad.find((p) => p.position === "FW")!
  }

  /** O'yinni "o'ynab", hisob, gollar, kartochkalar va tarkibni yozadi */
  const playMatch = (m: Match, forced?: { home: number; away: number }) => {
    const home = m.homeId!
    const away = m.awayId!
    const hs = forced ? forced.home : goalsFor(teamStrength(home), teamStrength(away))
    const as = forced ? forced.away : goalsFor(teamStrength(away), teamStrength(home))
    const minutes = new Set<number>()
    const minute = (max = 90) => {
      let v = 1 + Math.floor(rnd() * max)
      while (minutes.has(v)) v = 1 + Math.floor(rnd() * max)
      minutes.add(v)
      return v
    }
    const lineup = new Map<ID, Set<ID>>()
    for (const side of [home, away]) {
      const squad = rosterOf.get(side)!
      const byPos = (pos: Position, n: number) => shuffle(squad.filter((p) => p.position === pos), rnd).slice(0, n)
      const starters = [...byPos("GK", 1), ...byPos("DF", 4), ...byPos("MF", 4), ...byPos("FW", 2)]
      const bench = shuffle(squad.filter((p) => !starters.includes(p) && p.position !== "GK"), rnd).slice(0, Math.floor(rnd() * 4))
      lineup.set(side, new Set([...starters, ...bench].map((p) => p.id)))
    }
    const addGoals = (side: ID, other: ID, count: number) => {
      for (let i = 0; i < count; i++) {
        const roll = rnd()
        if (roll < 0.06) {
          const otherSquad = rosterOf.get(other)!.filter((p) => p.position === "DF")
          const og = pick(otherSquad)
          lineup.get(other)!.add(og.id)
          events.push({ id: id("e"), matchId: m.id, type: "OWN_GOAL", minute: minute(), playerId: og.id, seasonTeamId: other })
          continue
        }
        const squad = rosterOf.get(side)!
        const scorer = weightedScorer(squad)
        lineup.get(side)!.add(scorer.id)
        const type: EventType = roll < 0.15 ? "PENALTY_GOAL" : "GOAL"
        let assistId: ID | null = null
        if (type === "GOAL" && rnd() < 0.55) {
          const assister = weightedScorer(squad, scorer.id)
          assistId = assister.id
          lineup.get(side)!.add(assister.id)
        }
        events.push({ id: id("e"), matchId: m.id, type, minute: minute(), playerId: scorer.id, seasonTeamId: side, assistId })
      }
    }
    addGoals(home, away, hs)
    addGoals(away, home, as)
    for (const side of [home, away]) {
      const onPitch = [...lineup.get(side)!]
      const yellows = Math.floor(rnd() * 3.2)
      const carded = shuffle(onPitch, rnd).slice(0, yellows)
      for (const pid of carded) events.push({ id: id("e"), matchId: m.id, type: "YELLOW", minute: minute(), playerId: pid, seasonTeamId: side })
      if (rnd() < 0.05) {
        const pid = pick(onPitch.filter((x) => !carded.includes(x)))
        if (pid) events.push({ id: id("e"), matchId: m.id, type: "RED", minute: minute(), playerId: pid, seasonTeamId: side })
      }
      for (const pid of lineup.get(side)!) appearances.push({ matchId: m.id, seasonTeamId: side, playerId: pid })
    }
    m.status = "FINISHED"
    m.homeScore = hs
    m.awayScore = as
    m.decidedBy = "REGULAR"
    m.winnerId = hs > as ? home : hs < as ? away : null
    m.referee = pick(REFEREES)
  }

  const makeGroupMatches = (season: Season, group: Group, roundDates: string[], times: string[], groupIndex: number) => {
    const pairings = roundRobin(group.seasonTeamIds, season.rules.legs)
    const perRound = new Map<number, number>()
    return pairings.map((p) => {
      const n = perRound.get(p.round) ?? 0
      perRound.set(p.round, n + 1)
      const date = roundDates[p.round - 1]
      const slot = groupIndex * 2 + n
      const m: Match = {
        id: id("m"),
        seasonId: season.id,
        stage: "GROUP",
        groupId: group.id,
        round: p.round,
        homeId: p.homeId,
        awayId: p.awayId,
        kickoff: toLocalIso(slot >= times.length ? addDays(date, 1) : date, times[slot % times.length]),
        venueId: venues[0].id,
        status: "SCHEDULED",
        homeScore: null,
        awayScore: null,
      }
      matches.push(m)
      return m
    })
  }

  // ---------------- 1-mavsum: 2025 (yakunlangan, arxiv) ----------------
  const s2025: Season = {
    id: "s2025",
    number: 1,
    name: "1-mavsum",
    year: 2025,
    startDate: "2025-05-03",
    endDate: "2025-06-28",
    status: "FINISHED",
    rules: { ...defaultRules(), legs: 2 },
  }
  seasons.push(s2025)
  const teams2025 = teams.slice(0, 8)
  // Transferlar: 2025 yilda boshqa jamoada o'ynagan futbolchilar
  const transfers: [ID, ID][] = [
    [playersByTeam.get("t1")![14].id, "t3"],
    [playersByTeam.get("t2")![13].id, "t4"],
    [playersByTeam.get("t5")![12].id, "t1"],
  ]
  const st2025 = addSeasonTeams(s2025, teams2025, (team) => {
    const own = playersByTeam.get(team.id)!.filter((p) => !transfers.some(([pid]) => pid === p.id))
    const incoming = transfers.filter(([, to]) => to === team.id).map(([pid]) => players.find((p) => p.id === pid)!)
    return [...own, ...incoming]
  })
  const draw2025 = shuffle(st2025.map((s) => s.id), rnd)
  const g2025: Group[] = [
    { id: "g2025A", seasonId: s2025.id, name: "A", order: 0, seasonTeamIds: draw2025.slice(0, 4) },
    { id: "g2025B", seasonId: s2025.id, name: "B", order: 1, seasonTeamIds: draw2025.slice(4, 8) },
  ]
  groups.push(...g2025)
  const rounds2025 = Array.from({ length: 6 }, (_, r) => addDays("2025-05-03", r * 7))
  g2025.forEach((g, gi) => {
    for (const m of makeGroupMatches(s2025, g, rounds2025, ["10:00", "12:30", "15:00", "17:30"], gi)) playMatch(m)
  })
  const finish2025 = g2025.map((g) => ({
    name: g.name,
    table: computeStandings({
      teamIds: g.seasonTeamIds,
      matches: matches.filter((m) => m.groupId === g.id),
      events,
      rules: s2025.rules,
    }),
    qualifiers: qualifiersFor(s2025.rules, g.seasonTeamIds.length),
  }))
  const bracket2025 = createBracket({
    seasonId: s2025.id,
    plan: playoffPlan(finish2025),
    thirdPlace: true,
    kickoffFor: (round, i) => (round === "SF" ? toLocalIso("2025-06-21", i === 0 ? "16:00" : "18:00") : toLocalIso("2025-06-28", round === "THIRD" ? "15:00" : "18:00")),
    venueId: "v1",
    newId: () => id("m"),
  })
  matches.push(...bracket2025)
  const applyAdvance = (m: Match) => {
    for (const u of advancementUpdates(m)) {
      const target = matches.find((x) => x.id === u.matchId)!
      if (u.slot === "home") target.homeId = u.seasonTeamId
      else target.awayId = u.seasonTeamId
    }
  }
  for (const round of ["SF", "THIRD", "F"] as const) {
    for (const m of bracket2025.filter((x) => x.playoffRound === round)) {
      if (round === "F") {
        playMatch(m, { home: 1, away: 1 })
        m.homeExtra = 0
        m.awayExtra = 0
        m.homePens = 4
        m.awayPens = 3
        m.decidedBy = "PENALTIES"
        m.winnerId = m.homeId
      } else {
        playMatch(m)
        if (m.homeScore === m.awayScore) {
          // Pley-off: durangda qo'shimcha vaqtda bitta gol
          m.homeExtra = 1
          m.awayExtra = 0
          const squad = rosterOf.get(m.homeId!)!
          const scorer = weightedScorer(squad)
          events.push({ id: id("e"), matchId: m.id, type: "GOAL", minute: 104, playerId: scorer.id, seasonTeamId: m.homeId! })
          appearances.push({ matchId: m.id, seasonTeamId: m.homeId!, playerId: scorer.id })
          m.decidedBy = "EXTRA_TIME"
          m.winnerId = m.homeId
        }
      }
      applyAdvance(m)
    }
  }
  const final2025 = bracket2025.find((m) => m.playoffRound === "F")!
  const third2025 = bracket2025.find((m) => m.playoffRound === "THIRD")!
  const s2025Matches = matches.filter((m) => m.seasonId === s2025.id)
  const s2025Events = events.filter((e) => s2025Matches.some((m) => m.id === e.matchId))
  const stats2025 = computePlayerStats(s2025Matches, s2025Events, appearances.filter((a) => s2025Matches.some((m) => m.id === a.matchId)))
  const nameOfPlayer = (pid: ID) => {
    const p = players.find((x) => x.id === pid)!
    return `${p.firstName} ${p.lastName}`
  }
  const scorer2025 = topScorers(stats2025, nameOfPlayer)[0]
  const championId = final2025.winnerId!
  const championStats = stats2025
    .filter((s) => s.seasonTeamId === championId)
    .sort((a, b) => b.goals + b.assists - (a.goals + a.assists))
  const discipline2025 = computeTeamDiscipline(st2025.map((s) => s.id), s2025Matches, s2025Events)
  const runnerUp = final2025.winnerId === final2025.homeId ? final2025.awayId : final2025.homeId
  const bestKeeperTeam = st2025
    .map((s) => ({
      id: s.id,
      conceded: s2025Matches
        .filter((m) => m.homeId === s.id || m.awayId === s.id)
        .reduce((sum, m) => sum + (m.homeId === s.id ? m.awayScore ?? 0 : m.homeScore ?? 0), 0),
    }))
    .sort((a, b) => a.conceded - b.conceded)[0].id
  const keeper = rosterOf.get(bestKeeperTeam)!.find((p) => p.position === "GK")!
  awards.push(
    { id: id("a"), seasonId: s2025.id, type: "CHAMPION", seasonTeamId: championId },
    { id: id("a"), seasonId: s2025.id, type: "RUNNER_UP", seasonTeamId: runnerUp },
    { id: id("a"), seasonId: s2025.id, type: "THIRD", seasonTeamId: third2025.winnerId },
    { id: id("a"), seasonId: s2025.id, type: "TOP_SCORER", playerId: scorer2025.playerId, seasonTeamId: scorer2025.seasonTeamId, note: `${scorer2025.goals} ta gol` },
    { id: id("a"), seasonId: s2025.id, type: "BEST_PLAYER", playerId: championStats[0].playerId, seasonTeamId: championId },
    { id: id("a"), seasonId: s2025.id, type: "BEST_GOALKEEPER", playerId: keeper.id, seasonTeamId: bestKeeperTeam },
    { id: id("a"), seasonId: s2025.id, type: "FAIR_PLAY", seasonTeamId: discipline2025[0].seasonTeamId },
  )

  // ---------------- 2-mavsum: 2026 (joriy) ----------------
  const round1 = addDays(today, -14)
  const s2026: Season = {
    id: "s2026",
    number: 2,
    name: "2-mavsum",
    year: 2026,
    startDate: round1,
    endDate: addDays(today, 32),
    status: "ACTIVE",
    rules: defaultRules(),
  }
  seasons.push(s2026)
  const st2026 = addSeasonTeams(s2026, teams, (team) => playersByTeam.get(team.id)!)
  const draw2026 = shuffle(st2026.map((s) => s.id), rnd)
  const g2026: Group[] = ["A", "B", "C", "D"].map((name, i) => ({
    id: `g2026${name}`,
    seasonId: s2026.id,
    name,
    order: i,
    seasonTeamIds: draw2026.slice(i * 4, i * 4 + 4),
  }))
  groups.push(...g2026)
  const rounds2026 = [round1, addDays(today, -7), today]
  const times = ["10:00", "12:30", "15:00", "17:30"]
  g2026.forEach((g, gi) => {
    const dates = rounds2026.map((d) => (gi >= 2 ? addDays(d, 1) : d))
    const list = makeGroupMatches(s2026, g, dates, times, gi % 2)
    for (const m of list) {
      if (m.round! < 3) {
        if (g.name === "D" && m.round === 2 && list.filter((x) => x.round === 2).indexOf(m) === 1) {
          m.status = "POSTPONED"
          m.note = "Kuchli yomg‘ir sababli qoldirildi. Yangi sana tez orada e’lon qilinadi."
          continue
        }
        playMatch(m)
      }
    }
  })
  // Bugungi o'yinlar: biri yakunlangan, biri davom etmoqda, qolganlari rejalashtirilgan
  const todays = matches
    .filter((m) => m.seasonId === s2026.id && m.round === 3 && m.kickoff.startsWith(today))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  if (todays[0]) playMatch(todays[0])
  if (todays[1]) {
    const live = todays[1]
    playMatch(live)
    live.status = "LIVE"
    live.liveMinute = 63
    live.decidedBy = null
    live.winnerId = null
    // Jonli o'yinda faqat 63-daqiqagacha bo'lgan hodisalar qoladi
    const late = events.filter((e) => e.matchId === live.id && (e.minute ?? 0) > 63)
    for (const e of late) {
      events.splice(events.indexOf(e), 1)
      if (e.type === "GOAL" || e.type === "PENALTY_GOAL") {
        if (e.seasonTeamId === live.homeId) live.homeScore!--
        else live.awayScore!--
      } else if (e.type === "OWN_GOAL") {
        if (e.seasonTeamId === live.homeId) live.awayScore!--
        else live.homeScore!--
      }
    }
  }

  const iso = (daysAgo: number, time = "09:00") => toLocalIso(addDays(today, -daysAgo), time)

  return {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    settings: {
      name: "Payariq Oltin Ligasi",
      shortName: "Oltin Liga",
      region: "Payariq tumani, Samarqand viloyati",
      about:
        "Payariq Oltin Ligasi — tuman qishloqlari jamoalari ishtirokidagi havaskorlar futbol musobaqasi. Liga yoshlarni sportga jalb qilish, qishloqlar o‘rtasida do‘stlikni mustahkamlash va har mavsumda eng kuchli jamoani aniqlash maqsadida o‘tkaziladi.",
      contactPhone: "",
      telegram: "",
    },
    seasons,
    teams,
    seasonTeams,
    players,
    rosters,
    groups,
    venues,
    matches,
    events,
    appearances,
    adjustments: [],
    awards,
    news: [
      {
        id: "n1",
        slug: "3-tur-oyinlari-jadvali",
        title: "3-tur o‘yinlari jadvali e’lon qilindi",
        excerpt: "Guruh bosqichining so‘nggi turi bugun boshlanadi. Barcha o‘yinlar vaqti va maydonlari tasdiqlandi.",
        body:
          "Guruh bosqichining uchinchi, hal qiluvchi turi bugun boshlanadi. A va B guruhlari o‘yinlari bugun, C va D guruhlari o‘yinlari ertaga o‘tkaziladi.\n\nHar bir guruhdan ikki jamoa chorak finalga chiqadi. Jamoalar o‘yin boshlanishidan 30 daqiqa oldin maydonga yetib kelishi so‘raladi.\n\nO‘yinlar vaqti va maydonlari «O‘yinlar» bo‘limida ko‘rsatilgan.",
        publishedAt: iso(1, "18:00"),
        important: true,
        status: "PUBLISHED",
      },
      {
        id: "n2",
        slug: "d-guruhi-oyini-qoldirildi",
        title: "D guruhidagi o‘yin ob-havo sababli qoldirildi",
        excerpt: "2-turdagi o‘yinlardan biri kuchli yomg‘ir tufayli boshqa kunga ko‘chirildi.",
        body:
          "2-turda D guruhida o‘tishi kerak bo‘lgan o‘yinlardan biri kuchli yomg‘ir sababli qoldirildi. Maydon holati o‘yin o‘tkazish uchun xavfsiz emas deb topildi.\n\nYangi sana ikki jamoa vakillari bilan kelishilgandan so‘ng e’lon qilinadi.",
        publishedAt: iso(7, "11:00"),
        important: false,
        status: "PUBLISHED",
      },
      {
        id: "n3",
        slug: "2026-mavsum-quras-otkazildi",
        title: "2026-mavsum qur’asi o‘tkazildi",
        excerpt: "16 ta jamoa to‘rt guruhga taqsimlandi. Guruh bosqichi bir davrali tizimda o‘tadi.",
        body:
          "Ikkinchi mavsum qur’asi barcha jamoalar vakillari ishtirokida o‘tkazildi. 16 ta jamoa to‘rtta guruhga taqsimlandi.\n\nGuruh bosqichi bir davrali tizimda o‘tadi. Har guruhdan ikki jamoa chorak finalga yo‘l oladi.",
        publishedAt: iso(20, "15:00"),
        important: false,
        status: "PUBLISHED",
      },
      {
        id: "n4",
        slug: "homiylar-uchun-imkoniyatlar",
        title: "Homiylar uchun yangi imkoniyatlar",
        excerpt: "Tur homiysi va o‘yinning eng yaxshi futbolchisi nominatsiyasi homiyligi taklif etiladi.",
        body:
          "Liga mahalliy tadbirkorlarga hamkorlik qilishning yangi turlarini taklif etadi: tur homiysi, o‘yinning eng yaxshi futbolchisi nominatsiyasi va saytdagi reklama joylari.\n\nBatafsil ma’lumot uchun liga tashkilotchilari bilan bog‘laning.",
        publishedAt: iso(3, "10:00"),
        important: false,
        status: "PUBLISHED",
      },
      {
        id: "n5",
        slug: "2025-mavsum-yakunlandi",
        title: "1-mavsum yakunlandi: chempion aniqlandi",
        excerpt: "Final o‘yini penaltilar seriyasida hal bo‘ldi. Sovrindorlar taqdirlandi.",
        body:
          "Birinchi mavsum finali qizg‘in o‘tdi: asosiy va qo‘shimcha vaqt durang yakunlandi, g‘olib penaltilar seriyasida aniqlandi.\n\nMavsum sovrindorlari va eng yaxshi futbolchilar taqdirlandi. To‘liq natijalar «Mavsumlar arxivi» bo‘limida.",
        publishedAt: "2025-06-28T21:00:00+05:00",
        important: false,
        status: "PUBLISHED",
      },
    ],
    sponsors: [
      { id: "sp1", name: "Payariq Agro Servis", tier: "GENERAL", description: "Qishloq xo‘jaligi texnikasi va xizmatlari", url: "", active: true, order: 1 },
      { id: "sp2", name: "Zarafshon Qurilish", tier: "OFFICIAL", description: "Qurilish materiallari", url: "", active: true, order: 2 },
      { id: "sp3", name: "Oltin Don Market", tier: "OFFICIAL", description: "Oziq-ovqat do‘koni", url: "", active: true, order: 3 },
      { id: "sp4", name: "Chelak Avto Servis", tier: "PARTNER", description: "Avtomobillarga xizmat ko‘rsatish", url: "", active: true, order: 4 },
      { id: "sp5", name: "Bog‘bon fermer xo‘jaligi", tier: "PARTNER", description: "Meva va sabzavotlar", url: "", active: true, order: 5 },
      { id: "sp6", name: "Navro‘z To‘yxonasi", tier: "PARTNER", description: "Tadbirlar zali", url: "", active: true, order: 6 },
    ],
    audit: [
      { id: id("au"), at: iso(0, "11:45"), user: "Tashkilotchi", action: "Natija", summary: "3-tur birinchi o‘yini natijasi kiritildi" },
      { id: id("au"), at: iso(1, "18:00"), user: "Tashkilotchi", action: "Yangilik", summary: "«3-tur o‘yinlari jadvali e’lon qilindi» e’lon qilindi" },
      { id: id("au"), at: iso(7, "11:00"), user: "Tashkilotchi", action: "O‘yin", summary: "D guruhidagi o‘yin holati «Qoldirilgan»ga o‘zgartirildi" },
      { id: id("au"), at: iso(20, "15:00"), user: "Tashkilotchi", action: "Qur’a", summary: "2026-mavsum guruhlari tasdiqlandi" },
    ],
  }
}
