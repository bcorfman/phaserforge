# Project Data

`ProjectSpec` is PhaserForge's canonical project model. The editor state, cloud save API, local structured snapshots, publish packaging, and runtime loading all use validated `ProjectSpec` data.

YAML remains supported as a portable import/export format for backups, examples, bug reports, and compatibility testing. Opening YAML imports it into `ProjectSpec`; saving YAML exports the current `ProjectSpec`. YAML is not the canonical internal transport for persistence or publishing.

## Stars-Demo Feature Fields

Keep this section aligned with model types, validation, YAML tests, compiler behavior, and UI metadata.

### Field Summary

- `GameSceneSpec.backgroundColor?: number`: optional RGB integer; missing means default background; rendered behind background layers.
- `EntitySpec.tint?: number`: optional RGB integer; missing means white/no authored tint; selection styling must not overwrite it.
- Scatter layout: `group.layout = { type: 'arrange', arrangeKind: 'scatter', params }`.
- Event Blocks: `SceneSpec.eventBlocks` groups attachments under finite triggers.
- Attachment targeting: `targetMode?: 'owner' | 'event-source'`, defaulting to owner.
- `SetProperty` properties: `x`, `y`, `tint`, `alpha`, `visible`, `vx`, `vy`.
- `ValueSourceSpec`: `constant`, `randomRange`, or `eventField`.

```yaml
groups:
  stars:
    id: stars
    members: [star-1, star-2]
    layout:
      type: arrange
      arrangeKind: scatter
      params:
        minX: 0
        maxX: 720
        minY: 5
        maxY: 1285
        seed: stars-1
        randomTint: true
        tintMinR: 20
        tintMaxR: 255
        tintMinG: 20
        tintMaxG: 255
        tintMinB: 20
        tintMaxB: 255
eventBlocks:
  wrap:
    id: wrap
    target: { type: group, groupId: stars }
    trigger: { type: bounds, boundsEvent: wrapped, axis: y, side: any }
attachments:
  rerollX:
    id: rerollX
    target: { type: group, groupId: stars }
    eventId: wrap
    targetMode: event-source
    presetId: SetProperty
    params:
      property: x
      valueSource: { kind: randomRange, min: 0, max: 720, seed: wrap-x }
```

### Rules To Preserve

- Generated positions and tints are stored on member entities; layout params/seeds are retained only for intentional reapply/reroll.
- Member count is derived from `group.members`, not duplicated in generated metadata.
- Trigger types are finite: `start`, `update`, `input_action`, `visible`, `event`, `bounds`.
- Bounds values: `boundsEvent = contact-entered | contact-exited | wrapped | bounced | clamped | stopped`; `axis = any | x | y`; `side = any | left | right | bottom | top`.
- Runtime Bounds context includes source entity, owner target/event block, occurrence id/order, axis/side, prior position, and resolved position.
- Bounds Event Blocks receive only owner-scope events unless a future trigger explicitly defines broader scope.
- `event-source` resolves to the event source/instigator; for group-owned Bounds events this is the individual member that crossed.
- `randomRange` uses deterministic streams per action and event occurrence/source; runtime X/Y may stay continuous.
- Supported `eventField` names are `sourceId`, `outcome`, `axis`, `side`, `positionX`, `positionY`, `priorPositionX`, and `priorPositionY`; validation currently allows only numeric event fields for numeric/color properties.
- Do not encode this workflow through `Call`, host callbacks, arbitrary object paths, script text, formulas, or JSON expression blobs.
