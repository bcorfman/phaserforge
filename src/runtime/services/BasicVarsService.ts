import type { CollectionMemberRef, CollectionSpec, CounterSpec } from '../../model/types';
import type { VarsService } from './RuntimeServices';

function memberKey(member: CollectionMemberRef): string {
  if (member.type === 'entity') return `entity:${String(member.entityId ?? '')}`;
  return `group:${String(member.groupId ?? '')}`;
}

function normalizeMember(member: { type: 'entity' | 'group'; entityId?: string; groupId?: string }): CollectionMemberRef {
  return member.type === 'entity'
    ? { type: 'entity', entityId: String(member.entityId ?? '') }
    : { type: 'group', groupId: String(member.groupId ?? '') };
}

export class BasicVarsService implements VarsService {
  private readonly counters = new Map<string, { value: number; clamp?: { min?: number; max?: number }; derivedFromCollectionId?: string }>();
  private readonly collections = new Map<string, Map<string, CollectionMemberRef>>();
  private readonly derivedByCollection = new Map<string, string[]>();

  constructor(init?: { counters?: Record<string, CounterSpec>; collections?: Record<string, CollectionSpec> }) {
    const counters = init?.counters ?? {};
    const collections = init?.collections ?? {};

    for (const [id, spec] of Object.entries(collections)) {
      const members = new Map<string, CollectionMemberRef>();
      for (const m of spec.members ?? []) {
        const norm = normalizeMember(m as any);
        members.set(memberKey(norm), norm);
      }
      this.collections.set(id, members);
    }

    for (const [id, spec] of Object.entries(counters)) {
      this.counters.set(id, {
        value: Number.isFinite(Number(spec.value)) ? Number(spec.value) : 0,
        clamp: spec.clamp,
        derivedFromCollectionId: spec.derivedFromCollectionId,
      });
      if (spec.derivedFromCollectionId) {
        const list = this.derivedByCollection.get(spec.derivedFromCollectionId) ?? [];
        list.push(id);
        this.derivedByCollection.set(spec.derivedFromCollectionId, list);
      }
    }

    // Initialize derived counters.
    for (const [collectionId, counterIds] of this.derivedByCollection.entries()) {
      const count = this.getCollectionMembers(collectionId).length;
      for (const counterId of counterIds) {
        this.setCounter(counterId, count);
      }
    }
  }

  getCounter(id: string): number {
    return this.counters.get(id)?.value ?? 0;
  }

  setCounter(id: string, value: number): void {
    const existing = this.counters.get(id);
    const next = Number.isFinite(Number(value)) ? Number(value) : 0;
    if (!existing) {
      this.counters.set(id, { value: next });
      return;
    }
    existing.value = next;
    if (existing.clamp) this.clampCounter(id, existing.clamp);
  }

  addToCounter(id: string, delta: number): number {
    const current = this.getCounter(id);
    const next = current + (Number.isFinite(Number(delta)) ? Number(delta) : 0);
    this.setCounter(id, next);
    return this.getCounter(id);
  }

  clampCounter(id: string, clamp: { min?: number; max?: number }): number {
    const existing = this.counters.get(id) ?? { value: 0 };
    existing.clamp = clamp;
    const min = clamp.min;
    const max = clamp.max;
    let value = existing.value;
    if (typeof min === 'number' && Number.isFinite(min)) value = Math.max(min, value);
    if (typeof max === 'number' && Number.isFinite(max)) value = Math.min(max, value);
    existing.value = value;
    this.counters.set(id, existing);
    return value;
  }

  getCollectionMembers(id: string): CollectionMemberRef[] {
    const members = this.collections.get(id);
    if (!members) return [];
    return Array.from(members.values());
  }

  setCollectionMembers(id: string, members: CollectionMemberRef[]): void {
    const map = new Map<string, CollectionMemberRef>();
    for (const m of members ?? []) {
      const norm = normalizeMember(m as any);
      map.set(memberKey(norm), norm);
    }
    this.collections.set(id, map);
    this.syncDerivedCountersForCollection(id);
  }

  addToCollection(id: string, member: CollectionMemberRef): void {
    const norm = normalizeMember(member as any);
    const map = this.collections.get(id) ?? new Map<string, CollectionMemberRef>();
    map.set(memberKey(norm), norm);
    this.collections.set(id, map);
    this.syncDerivedCountersForCollection(id);
  }

  removeFromCollection(id: string, member: CollectionMemberRef): void {
    const norm = normalizeMember(member as any);
    const map = this.collections.get(id);
    if (!map) return;
    map.delete(memberKey(norm));
    this.syncDerivedCountersForCollection(id);
  }

  private syncDerivedCountersForCollection(collectionId: string): void {
    const derived = this.derivedByCollection.get(collectionId) ?? [];
    if (derived.length === 0) return;
    const count = this.getCollectionMembers(collectionId).length;
    for (const counterId of derived) {
      this.setCounter(counterId, count);
    }
  }
}

