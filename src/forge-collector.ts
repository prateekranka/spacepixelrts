/**
 * FTR-CORE — instance-scoped Forge Trace collector (docs/FORGE_TRACE.md §7, frozen).
 *
 * The collector instruments ONE World instance from the outside — it never
 * patches World.prototype and never touches sim internals:
 *
 *  - attach() saves the instance's tryPlace / tryTrain / tryCommitPath / issue
 *    methods (bound originals, own-vs-prototype tracked for exact restore on
 *    detach) and replaces them with recording wrappers. issue is wrapped too —
 *    the event taxonomy fixes a `command-issue` event, which can only come from
 *    the public issue() seam. Because the sim calls its own methods through the
 *    instance, AI placement/training/path calls flow through the wrappers as
 *    well, so attempts are recorded for ALL teams.
 *  - observe() diffs bounded public state against the previous observation
 *    (typed arrays keyed by ent id — no per-tick snapshots, O(alive) cost) to
 *    derive construction / training / order / combat / death / core / lumen /
 *    path events, and emits exactly one resource-sample + population-sample per
 *    team per simulated second (every 20 ticks). The first observe after attach
 *    emits match-start and establishes the baseline; a pre-baseline corpse
 *    (world.kill before any step) is recorded as fault-injection when
 *    faultInjectionAllowed is true.
 *  - Milestone-class events (CHECKPOINT_EVENT_TYPES) carry a fresh worldHash
 *    (docs/FORGE_TRACE.md §6) and push into checkpoints. The world hash is
 *    recomputed at most once per tick (memoized) and, with the default
 *    hashEveryTicks: 1, warmed every tick for bounded-diff sampling.
 *  - finalize() emits core-destruction / winner / match-terminal exactly once
 *    based on world.winner, then freezes the stream (observe() no-ops).
 *
 * Determinism: every emitted value is a pure function of public world state —
 * no Date, no RNG, no Math.random. world.reset() invalidates an attached
 * collector (documented; runners create a fresh collector after reset).
 */

import { Kind, MAX_ENTS, Ord, TICK_HZ } from './engine';
import type { World } from './sim';
import { gateOpen, isBuilding, STATS } from './content';
import {
  CHECKPOINT_EVENT_TYPES,
  DEFAULT_CAMERA_PRESET,
  kindName,
  legacyCivToFaction,
} from './pacing-contract';
import type { ForgeEventType } from './pacing-contract';
import type { FactionId, MatchConfig } from './match-config';
import type { DiscoveryEvent } from './discovery';
import { worldIdentityHash } from './forge-snapshot';
import type { CheckpointEntry, ForgeTraceEvent, FrameRef } from './forge-schema';

type WorldMethodName = 'tryPlace' | 'tryTrain' | 'tryCommitPath' | 'issue';

interface SavedMethod {
  name: WorldMethodName;
  unbound: (...args: any[]) => any;
  bound: (...args: any[]) => any;
  wasOwn: boolean;
}

interface InstrumentedWorld extends World {
  tryPlace: World['tryPlace'];
  tryTrain: World['tryTrain'];
  tryCommitPath: World['tryCommitPath'];
  issue: World['issue'];
}

interface EcoPoint {
  ore: number;
  gas: number;
  energy: number;
}

interface LumenPrev {
  owner: number;
  capturing: number;
  contested: boolean;
  progress: number;
  pulse: [number, number];
}

const ORDER_NAMES: Record<number, string> = {
  [Ord.Idle]: 'idle',
  [Ord.Move]: 'move',
  [Ord.Attack]: 'attack',
  [Ord.Gather]: 'gather',
  [Ord.Return]: 'return',
  [Ord.Build]: 'build',
  [Ord.AttackMove]: 'attack-move',
};

function ordName(ord: number): string {
  return ORDER_NAMES[ord] ?? `order-${ord}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Unit-kind guard (units only; buildings and resources are never combat victims). */
function isUnitKind(kind: Kind): boolean {
  return (
    kind === Kind.Worker ||
    kind === Kind.Scout ||
    kind === Kind.Fighter ||
    kind === Kind.Ravager ||
    kind === Kind.Prism
  );
}

/** True when the value was observed at least once (NaN sentinel = never). */
function isObserved(value: number): boolean {
  return !Number.isNaN(value);
}

/** Canonical faction of a sim team index (null for neutral/voidmarked/unmapped). */
function factionOf(world: World, team: number): FactionId | null {
  if (team !== 0 && team !== 1) return null;
  return legacyCivToFaction(world.civ[team]);
}

function saveMethod(world: InstrumentedWorld, name: WorldMethodName): SavedMethod {
  const unbound = world[name];
  const wasOwn = Object.prototype.hasOwnProperty.call(world, name);
  return { name, unbound, bound: unbound.bind(world), wasOwn };
}

export class ForgeTraceCollector {
  /** Complete canonical config used in every frameRef (cloned at construction). */
  private readonly config: MatchConfig;
  private readonly policyId: string;
  private readonly camera: { x: number; z: number; halfH: number };
  private readonly hashEveryTicks: number;
  private readonly faultInjectionAllowed: boolean;
  private readonly world: World;

  readonly events: ForgeTraceEvent[] = [];
  readonly checkpoints: CheckpointEntry[] = [];

  private seq = 0;
  private attached = false;
  private savedMethods: SavedMethod[] = [];
  private prevOnDiscover: World['onDiscover'];
  private baselineEstablished = false;
  private finalized = false;

  // Per-entity previous observation state, keyed by ent id (id === ents index).
  private readonly prevAlive = new Uint8Array(MAX_ENTS);
  private readonly prevHp = new Float64Array(MAX_ENTS);
  private readonly prevOrder = new Float64Array(MAX_ENTS);
  private readonly prevTx = new Float64Array(MAX_ENTS);
  private readonly prevTz = new Float64Array(MAX_ENTS);
  private readonly prevTid = new Float64Array(MAX_ENTS);
  private readonly prevCombatT = new Float64Array(MAX_ENTS);
  private readonly prevTrainT = new Float64Array(MAX_ENTS);
  private readonly prevProgress = new Float64Array(MAX_ENTS);

  private prevEco: [EcoPoint, EcoPoint] = [
    { ore: 0, gas: 0, energy: 0 },
    { ore: 0, gas: 0, energy: 0 },
  ];
  private prevLumen: LumenPrev = { owner: -1, capturing: -1, contested: false, progress: 0, pulse: [0, 0] };
  private prevTechPath: (string | null)[] = [null, null];
  private prevPendingPath: (string | null)[] = [null, null];
  /** Original player/rival Core ent index; -1 until first observation. */
  private readonly coreEntityIndex: [number, number] = [-1, -1];
  private readonly prevCoreHp: [number, number] = [Number.NaN, Number.NaN];
  private lastSampleTick = -1;
  private maxGain: [number, number] = [0, 0];
  private cachedHashTick = -1;
  private cachedHash = '';

  constructor(
    world: World,
    options: {
      config: MatchConfig;
      policyId: string;
      camera?: { x: number; z: number; halfH: number };
      hashEveryTicks?: number;
      faultInjectionAllowed?: boolean;
    },
  ) {
    this.world = world;
    this.config = { ...options.config };
    this.policyId = options.policyId;
    this.camera = options.camera ? { ...options.camera } : { ...DEFAULT_CAMERA_PRESET };
    this.hashEveryTicks = Math.max(1, Math.floor(options.hashEveryTicks ?? 1));
    this.faultInjectionAllowed = options.faultInjectionAllowed ?? false;
  }

  /** Wrap the instance's public mutation seams; subscribe onDiscover. Idempotent. */
  attach(): void {
    if (this.attached) return;
    const world = this.world as InstrumentedWorld;

    const place = saveMethod(world, 'tryPlace');
    const train = saveMethod(world, 'tryTrain');
    const commit = saveMethod(world, 'tryCommitPath');
    const issue = saveMethod(world, 'issue');
    this.savedMethods = [place, train, commit, issue];

    world.tryPlace = (team, kind, x, z, builderId): boolean => {
      const before = this.ecoOf(team);
      const ok = (place.bound as World['tryPlace'])(team, kind, x, z, builderId);
      const after = this.ecoOf(team);
      const cost = costDelta(before, after);
      const payload: Record<string, unknown> = {
        ok,
        kind: kindName(kind),
        x,
        z,
        builderId,
        ore: cost.ore,
        gas: cost.gas,
        energy: cost.energy,
      };
      if (!ok) payload.rejectReason = this.placementRejectReason(team, kind, x, z, builderId);
      // Related ent ids: the placed structure first, then the team's alive
      // Yards (production context of the placement). All ids are real, alive
      // entities at the call site; primary id is entityIds[0].
      const entityIds: number[] = [];
      if (ok) {
        const builder = this.world.ents[builderId];
        if (builder && builder.tid >= 0 && builder.order === Ord.Build) entityIds.push(builder.tid);
        for (let i = 0; i < MAX_ENTS; i++) {
          const entity = this.world.ents[i];
          if (entity.alive && entity.team === team && entity.kind === Kind.Barracks && i !== entityIds[0]) {
            entityIds.push(i);
          }
        }
      }
      this.emit('placement-attempt', factionOf(this.world, team), entityIds, payload);
      return ok;
    };

    world.tryTrain = (building, kind): boolean => {
      const before = this.ecoOf(building.team);
      const ok = (train.bound as World['tryTrain'])(building, kind);
      const after = this.ecoOf(building.team);
      const cost = costDelta(before, after);
      const payload: Record<string, unknown> = {
        ok,
        kind: kindName(kind),
        buildingId: building.id,
        ore: cost.ore,
        gas: cost.gas,
        energy: cost.energy,
      };
      if (!ok) payload.rejectReason = this.trainRejectReason(building, kind);
      this.emit('training-attempt', factionOf(this.world, building.team), [building.id], payload);
      return ok;
    };

    world.tryCommitPath = (team, path): boolean => {
      const before = this.ecoOf(team);
      const ok = (commit.bound as World['tryCommitPath'])(team, path);
      const after = this.ecoOf(team);
      const cost = costDelta(before, after);
      const payload: Record<string, unknown> = {
        ok,
        path,
        ore: cost.ore,
        gas: cost.gas,
        energy: cost.energy,
      };
      if (!ok) payload.rejectReason = this.commitRejectReason(team);
      this.emit('path-commit-attempt', factionOf(this.world, team), [], payload);
      return ok;
    };

    world.issue = (ids, ord, x, z, tid): void => {
      const aliveIds: number[] = [];
      let team: FactionId | null = null;
      for (const id of ids) {
        const entity = this.world.ents[id];
        if (entity && entity.alive) {
          aliveIds.push(id);
          if (team === null && (entity.team === 0 || entity.team === 1)) team = factionOf(this.world, entity.team);
        }
      }
      (issue.bound as World['issue'])(ids, ord, x, z, tid);
      this.emit('command-issue', team, aliveIds, { order: ordName(ord), x, z, tid });
    };

    this.prevOnDiscover = this.world.onDiscover;
    this.world.onDiscover = (event: DiscoveryEvent): void => {
      this.prevOnDiscover?.(event);
      this.handleDiscovery(event);
    };

    this.attached = true;
  }

  /** Restore the original instance methods and discovery handler. Idempotent. */
  detach(): void {
    if (!this.attached) return;
    const target = this.world as unknown as Record<string, unknown>;
    for (const saved of this.savedMethods) {
      if (saved.wasOwn) target[saved.name] = saved.unbound;
      else delete target[saved.name];
    }
    this.savedMethods = [];
    this.world.onDiscover = this.prevOnDiscover;
    this.prevOnDiscover = undefined;
    this.attached = false;
  }

  /**
   * Diff scan. Call after world.step() and after bare mutations. Emits
   * match-start on the first call, then derives state-change events from
   * bounded diffs. Safe to call multiple times per tick (idempotent).
   */
  observe(): void {
    if (this.finalized) return;
    const world = this.world;
    const tick = world.tick;

    if (!this.baselineEstablished) {
      this.baselineEstablished = true;
      this.emit('match-start', null, [], {
        playerFaction: this.config.playerFaction,
        aiFaction: this.config.aiFaction,
      });
      // A corpse present at baseline means world.kill() ran before any step —
      // the only legal kill is the lost-scout-recovery fault injection.
      if (this.faultInjectionAllowed) {
        for (let i = 0; i < MAX_ENTS; i++) {
          const entity = world.ents[i];
          if (entity.alive && entity.hp <= 0 && (entity.dissolveT > 0 || entity.corpseT > 0)) {
            this.emit('fault-injection', factionOf(world, entity.team), [i], {}, 'failure');
          }
        }
      }
      this.syncBaseline();
      return;
    }

    // Latch the original Core entities once (first post-baseline observation).
    if (this.coreEntityIndex[0] < 0) {
      for (let i = 0; i < MAX_ENTS; i++) {
        const e = world.ents[i];
        if (!e.alive || e.kind !== Kind.Hall) continue;
        if (e.team === 0 && this.coreEntityIndex[0] < 0) this.coreEntityIndex[0] = i;
        if (e.team === 1 && this.coreEntityIndex[1] < 0) this.coreEntityIndex[1] = i;
      }
    }

    // Bounded-diff sampling: warm the world hash every hashEveryTicks ticks.
    if (tick % this.hashEveryTicks === 0) this.hashAt(world, tick);

    // Per-team positive eco gain since the last observation (grant detection).
    for (let t = 0; t < 2; t++) {
      const eco = world.teams[t];
      const gain =
        Math.max(0, eco.ore - this.prevEco[t].ore) +
        Math.max(0, eco.gas - this.prevEco[t].gas) +
        Math.max(0, eco.energy - this.prevEco[t].energy);
      if (gain > this.maxGain[t]) this.maxGain[t] = gain;
    }

    // Sample cadence: exactly one resource + one population sample per team
    // per simulated second (every 20 ticks).
    if (tick > 0 && tick % TICK_HZ === 0 && this.lastSampleTick !== tick) {
      this.lastSampleTick = tick;
      for (let t = 0; t < 2; t++) {
        const eco = world.teams[t];
        this.emit('resource-sample', factionOf(world, t), [], { ore: eco.ore, gas: eco.gas, energy: eco.energy });
        this.emit('population-sample', factionOf(world, t), [], { pop: eco.pop, cap: eco.cap });
      }
    }

    // Per-entity diff pass (read-only; prev state updates after the pass so
    // combat damage attribution sees consistent previous values).
    for (let i = 0; i < MAX_ENTS; i++) {
      const entity = world.ents[i];
      const prevAlive = this.prevAlive[i] === 1;
      const nowAlive = entity.alive && entity.hp > 0;
      const teamOk = entity.team === 0 || entity.team === 1;
      const building = isBuilding(entity.kind);
      const resource = entity.kind === Kind.Resource;

      // Deaths: alive+hp>0 -> dead. Buildings (incl. Hall) are terminal events.
      if (prevAlive && !nowAlive && teamOk && !building && !resource) {
        this.emit('unit-death', factionOf(world, entity.team), [i], { kind: kindName(entity.kind) });
        if (entity.kind === Kind.Scout) this.emit('scout-loss', factionOf(world, entity.team), [i], {});
      }

      // Core damage is handled once below via coreEntityIndex (reads the real
      // Core hp; bystander tid heuristics cannot produce phantom damage).

      // Construction: a new alive building starts at progress < 1; completion
      // is the <1 -> >=1 progress transition.
      if (nowAlive && building && teamOk && !prevAlive) {
        this.emit('construction-start', factionOf(world, entity.team), [i], {
          kind: kindName(entity.kind),
          x: entity.x,
          z: entity.z,
        });
      } else if (nowAlive && building && teamOk && this.prevProgress[i] < 1 && entity.progress >= 1) {
        this.emit('construction-complete', factionOf(world, entity.team), [i], {
          kind: kindName(entity.kind),
          x: entity.x,
          z: entity.z,
        });
      }

      // Training: building trainT 0 -> positive.
      if (nowAlive && building && teamOk && this.prevTrainT[i] === 0 && entity.trainT > 0) {
        this.emit('training-start', factionOf(world, entity.team), [i], {
          kind: kindName(entity.trainKind),
          buildingId: i,
          trainT: round2(entity.trainT),
        });
        if (entity.trainKind === Kind.Scout && !this.hasLivingScout(entity.team, -1)) {
          this.emit('scout-replacement-start', factionOf(world, entity.team), [i], {});
        }
      }

      // Unit completion: a new alive non-building, non-resource entity.
      if (nowAlive && !prevAlive && teamOk && !building && !resource) {
        this.emit('unit-completion', factionOf(world, entity.team), [i], {
          kind: kindName(entity.kind),
          x: entity.x,
          z: entity.z,
        });
        if (entity.kind === Kind.Scout && !this.hasLivingScout(entity.team, i)) {
          this.emit('scout-replacement-complete', factionOf(world, entity.team), [i], {});
        }
      }

      // Order change: any actual change in order / target / target id.
      if (
        nowAlive &&
        teamOk &&
        !resource &&
        (entity.order !== this.prevOrder[i] ||
          entity.tx !== this.prevTx[i] ||
          entity.tz !== this.prevTz[i] ||
          entity.tid !== this.prevTid[i])
      ) {
        this.emit('order-change', factionOf(world, entity.team), [i], {
          order: ordName(entity.order),
          tx: entity.tx,
          tz: entity.tz,
          tid: entity.tid,
        });
      }

      // Worker assignment: a gathering worker switched target node.
      if (
        nowAlive &&
        entity.kind === Kind.Worker &&
        teamOk &&
        (entity.order === Ord.Gather || entity.order === Ord.Return) &&
        entity.tid >= 0 &&
        entity.tid !== this.prevTid[i]
      ) {
        this.emit('worker-assignment-change', factionOf(world, entity.team), [i], { nodeId: entity.tid });
      }

      // Combat engagement: combatT 0 -> positive, with a damage attribution
      // heuristic — the victim's hp drop over the interval, rounded to 0.1.
      // Combat is strictly cross-team: same-team tid targets (a worker building
      // its own structure, a Hall under construction) are legal work, not
      // combat, and must never emit engagement events.
      const victimCandidate = entity.tid >= 0 ? world.ents[entity.tid] : undefined;
      const isCrossTeamCombat =
        nowAlive &&
        teamOk &&
        !resource &&
        this.prevCombatT[i] === 0 &&
        entity.combatT > 0 &&
        victimCandidate !== undefined &&
        isUnitKind(victimCandidate.kind) === true &&
        victimCandidate.team !== entity.team;
      if (isCrossTeamCombat && victimCandidate !== undefined) {
        const victim = victimCandidate;
        if ((victim.alive || victim.hp <= 0) && this.prevHp[victim.id] > 0) {
          const damage = round1(Math.max(0, this.prevHp[victim.id] - Math.max(0, victim.hp)));
          if (damage > 0) {
            this.emit('combat-engagement', factionOf(world, entity.team), [i, victim.id], {
              attackerId: i,
              victimId: victim.id,
              damage,
              targetKind: kindName(victim.kind),
              targetTeam: victim.team === 0 ? 'player' : victim.team === 1 ? 'rival' : 'neutral',
            });
          }
        }
      }
    }

    // Core damage: the player or rival Core's hp decreased. This reads the
    // actual Core hp (never a bystander's tid), so self-repair and unrelated
    // combat cannot produce phantom core-damage events.
    for (const team of [0, 1] as const) {
      const hallIndex = this.coreEntityIndex[team];
      if (hallIndex < 0) continue;
      const hall = world.ents[hallIndex];
      if (hall === undefined || !hall.alive || hall.kind !== Kind.Hall) continue;
      const prevCoreHp = this.prevCoreHp[team];
      if (!isObserved(prevCoreHp)) continue;
      this.prevCoreHp[team] = hall.hp;
      if (hall.hp < prevCoreHp - 1e-9) {
        const attackerTeam = team === 0 ? 1 : 0;
        this.emit(
          'core-damage',
          factionOf(world, team),
          [hall.id],
          { hpBefore: round1(prevCoreHp), hpAfter: round1(hall.hp), byTeam: factionOf(world, attackerTeam) },
        );
      }
    }

    // Lumen field state transitions (lumenState() is read-only).
    const lumen = world.lumenState();
    if (lumen.capturing !== -1 && lumen.capturing !== this.prevLumen.capturing) {
      this.emit('lumen-capture-start', factionOf(world, lumen.capturing), [], {});
    }
    if (lumen.contested && !this.prevLumen.contested) {
      this.emit('lumen-contested', null, [], {});
    }
    if (lumen.owner !== -1 && lumen.owner !== this.prevLumen.owner) {
      this.emit('lumen-owner-change', factionOf(world, lumen.owner), [], {});
    }
    for (let t = 0; t < 2; t++) {
      if (this.prevLumen.pulse[t] === 0 && lumen.pulseRemaining[t] > 0) {
        this.emit('lumen-vision-pulse', factionOf(world, t), [], {});
      }
    }
    if (lumen.owner === 0 || lumen.owner === 1) {
      const owner = lumen.owner;
      if (world.teams[owner].energy - this.prevEco[owner].energy >= 0.5) {
        this.emit('lumen-income', factionOf(world, owner), [], { amount: 1 });
      }
    }
    this.prevLumen = {
      owner: lumen.owner,
      capturing: lumen.capturing,
      contested: lumen.contested,
      progress: lumen.progress,
      pulse: [lumen.pulseRemaining[0], lumen.pulseRemaining[1]],
    };

    // Technology path transitions from ageT / pendingPathOf / techPathOf.
    for (let t = 0; t < 2; t++) {
      const pending = world.pendingPathOf(t);
      const tech = world.techPathOf(t);
      if (this.prevPendingPath[t] === null && pending !== null) {
        this.emit('path-channel-start', factionOf(world, t), [], { path: pending });
      }
      if (this.prevTechPath[t] === null && tech !== null) {
        this.emit('technology-path-lock', factionOf(world, t), [], { path: tech });
      }
      this.prevPendingPath[t] = pending;
      this.prevTechPath[t] = tech;
    }

    this.syncPrevEco();
    this.syncPrevEnts();
  }

  /** Per-step positive resource-gain peak for a team (grant detection bound). */
  maxPositiveStepGain(teamIndex: 0 | 1): number {
    return this.maxGain[teamIndex] ?? 0;
  }

  /**
   * Emit the terminal event family exactly once based on world.winner and
   * freeze the stream: subsequent observe() calls no-op.
   */
  finalize(): void {
    if (this.finalized) return;
    const winner = this.world.winner;
    if (winner === 0 || winner === 1) {
      const loser = winner === 0 ? 1 : 0;
      const deadHall = this.world.ents.find(
        (entity) => entity.kind === Kind.Hall && entity.team === loser && !(entity.alive && entity.hp > 0),
      );
      this.emit('core-destruction', factionOf(this.world, loser), deadHall ? [deadHall.id] : [], {});
      this.emit('winner', factionOf(this.world, winner), [], {});
      this.emit('match-terminal', null, [], { reason: 'core-destroyed' });
    } else {
      this.emit('match-terminal', null, [], { reason: 'time-cap' });
    }
    this.finalized = true;
  }

  // --- Internals -------------------------------------------------------------

  private hasLivingScout(team: number, excludeId: number): boolean {
    for (let i = 0; i < MAX_ENTS; i++) {
      const entity = this.world.ents[i];
      if (i === excludeId) continue;
      if (entity.alive && entity.hp > 0 && entity.team === team && entity.kind === Kind.Scout) return true;
    }
    return false;
  }

  private handleDiscovery(event: DiscoveryEvent): void {
    if (!this.baselineEstablished || this.finalized) return;
    const team = factionOf(this.world, event.team);
    if (typeof event.id === 'number') {
      const entity = this.world.ents[event.id];
      const what = entity ? kindName(entity.kind) : event.kind;
      this.emitDiscovery('entity-discovery', team, [event.id], { what, x: event.x, z: event.z });
    } else {
      // Landmark discovery is a checkpoint-class event: hash the world now
      // (mid-step state at the discovery call site — deterministic).
      this.emitDiscovery('landmark-discovery', team, [], { what: event.id, x: event.x, z: event.z });
    }
  }

  private ecoOf(team: number): EcoPoint {
    const eco = this.world.teams[team];
    if (!eco) return { ore: 0, gas: 0, energy: 0 };
    return { ore: eco.ore, gas: eco.gas, energy: eco.energy };
  }

  private placementRejectReason(team: number, kind: Kind, x: number, z: number, builderId: number): string {
    const st = STATS[kind];
    const eco = this.world.teams[team];
    if (eco && (eco.ore < st.ore || eco.gas < st.gas || eco.energy < st.energy)) return 'affordability';
    if (!this.world.canPlace(x, z, st.radius)) return 'placement-blocked';
    const builder = this.world.ents[builderId];
    if (!builder || !builder.alive || builder.kind !== Kind.Worker) return 'builder-unavailable';
    return 'invalid';
  }

  private trainRejectReason(building: EntLike, kind: Kind): string {
    if (!building.alive || !isBuilding(building.kind)) return 'invalid-building';
    const st = STATS[kind];
    const eco = this.world.teams[building.team];
    if (building.trainT > 0) return 'busy';
    if (eco && (eco.ore < st.ore || eco.gas < st.gas || eco.energy < st.energy)) return 'affordability';
    if (eco && eco.pop + st.pop > eco.cap) return 'pop-cap';
    if (eco && building.kind === Kind.Barracks && !gateOpen(eco, kind)) return 'path-gated';
    return 'invalid';
  }

  private commitRejectReason(team: number): string {
    const eco = this.world.teams[team];
    if (!eco) return 'invalid';
    if (eco.epoch !== 0 || eco.ageT > 0 || eco.techPath !== null) return 'state';
    let hallReady = false;
    let hallBusy = false;
    for (let i = 0; i < MAX_ENTS; i++) {
      const entity = this.world.ents[i];
      if (!entity.alive || entity.team !== team || entity.kind !== Kind.Hall) continue;
      if (entity.trainT > 0) hallBusy = true;
      if (entity.hp > 0 && entity.progress >= 1) hallReady = true;
    }
    if (!hallReady) return 'no-ready-core';
    if (hallBusy) return 'busy';
    return 'affordability';
  }

  private makeFrameRef(): FrameRef {
    return {
      policyId: this.policyId,
      config: this.config,
      seed: this.world.seed,
      tick: this.world.tick,
      perspective: 'observer',
      camera: this.camera,
      selectedEntityIds: [],
    };
  }

  private hashAt(world: World, tick: number): string {
    if (this.cachedHashTick !== tick) {
      this.cachedHashTick = tick;
      this.cachedHash = worldIdentityHash(world);
    }
    return this.cachedHash;
  }

  private emit(
    type: ForgeEventType,
    team: FactionId | null,
    entityIds: number[],
    payload: Record<string, unknown>,
    severity: 'info' | 'warning' | 'failure' = 'info',
  ): void {
    if (this.finalized) return;
    const checkpoint = (CHECKPOINT_EVENT_TYPES as readonly string[]).includes(type);
    const hash = checkpoint ? this.hashAt(this.world, this.world.tick) : null;
    this.pushEvent(type, team, entityIds, payload, severity, hash);
  }

  /** Emit from the onDiscover call site (mid-step); hashes the world fresh. */
  private emitDiscovery(
    type: ForgeEventType,
    team: FactionId | null,
    entityIds: number[],
    payload: Record<string, unknown>,
  ): void {
    if (this.finalized) return;
    const checkpoint = (CHECKPOINT_EVENT_TYPES as readonly string[]).includes(type);
    const hash = checkpoint ? worldIdentityHash(this.world) : null;
    this.pushEvent(type, team, entityIds, payload, 'info', hash);
  }

  private pushEvent(
    type: ForgeEventType,
    team: FactionId | null,
    entityIds: number[],
    payload: Record<string, unknown>,
    severity: 'info' | 'warning' | 'failure',
    hash: string | null,
  ): void {
    const tick = this.world.tick;
    const event: ForgeTraceEvent = {
      eventId: `evt-${this.seq}`,
      seq: this.seq++,
      tick,
      seconds: tick / TICK_HZ,
      type,
      team,
      entityIds,
      payload,
      worldHash: hash,
      frameRef: this.makeFrameRef(),
      severity,
    };
    this.events.push(event);
    if (hash !== null) this.checkpoints.push({ seq: this.checkpoints.length, tick, worldHash: hash });
  }

  private syncBaseline(): void {
    const world = this.world;
    this.lastSampleTick = world.tick;
    this.syncPrevEco();
    this.syncPrevEnts();
    const lumen = world.lumenState();
    this.prevLumen = {
      owner: lumen.owner,
      capturing: lumen.capturing,
      contested: lumen.contested,
      progress: lumen.progress,
      pulse: [lumen.pulseRemaining[0], lumen.pulseRemaining[1]],
    };
    for (let t = 0; t < 2; t++) {
      this.prevTechPath[t] = world.techPathOf(t);
      this.prevPendingPath[t] = world.pendingPathOf(t);
    }
  }

  private syncPrevEco(): void {
    for (let t = 0; t < 2; t++) {
      const eco = this.world.teams[t];
      this.prevEco[t] = { ore: eco.ore, gas: eco.gas, energy: eco.energy };
    }
  }

  private syncPrevEnts(): void {
    const world = this.world;
    for (let i = 0; i < MAX_ENTS; i++) {
      const entity = world.ents[i];
      this.prevAlive[i] = entity.alive && entity.hp > 0 ? 1 : 0;
      this.prevHp[i] = entity.hp;
      this.prevOrder[i] = entity.order;
      this.prevTx[i] = entity.tx;
      this.prevTz[i] = entity.tz;
      this.prevTid[i] = entity.tid;
      this.prevCombatT[i] = entity.combatT;
      this.prevTrainT[i] = entity.trainT;
      this.prevProgress[i] = entity.progress;
    }
  }
}

/** Cost-positive deltas: amounts removed from the team eco (never negative). */
function costDelta(before: EcoPoint, after: EcoPoint): EcoPoint {
  return {
    ore: Math.max(0, before.ore - after.ore),
    gas: Math.max(0, before.gas - after.gas),
    energy: Math.max(0, before.energy - after.energy),
  };
}

/** Minimal shape of the building Ent the train wrapper needs (avoids Ent import cycle noise). */
interface EntLike {
  id: number;
  alive: boolean;
  team: number;
  kind: Kind;
  trainT: number;
}
