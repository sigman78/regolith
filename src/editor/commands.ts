/**
 * Commands are pure (doc) -> doc functions with a label. Undo does not need
 * hand-written inverses: documents are immutable, so the store keeps the
 * before/after snapshots (structurally shared, so cheap).
 */
import {
  addLink,
  addPart,
  removeLink,
  removePart,
  setPartParams,
  setPartPose,
  type BaseDocument,
  type Link,
  type NewPart,
  type ParamBag,
  type PartId,
  type PartPose,
} from '@/world/document';

export interface Command {
  readonly label: string;
  apply(doc: BaseDocument): BaseDocument;
}

export const cmd = {
  addPart(part: NewPart): Command {
    return { label: `Add ${part.letter}`, apply: (d) => addPart(d, part) };
  },
  removePart(id: PartId): Command {
    return { label: 'Delete part', apply: (d) => removePart(d, id) };
  },
  setParams(id: PartId, params: ParamBag): Command {
    return { label: 'Resize part', apply: (d) => setPartParams(d, id, params) };
  },
  /** Params and pose in one step, so a drag-to-grow is a single document change. */
  edit(id: PartId, patch: { params?: ParamBag; pose?: PartPose }): Command {
    return {
      label: 'Resize part',
      apply: (d) => {
        const withParams = patch.params ? setPartParams(d, id, patch.params) : d;
        return patch.pose ? setPartPose(withParams, id, patch.pose) : withParams;
      },
    };
  },
  setPose(id: PartId, pose: PartPose): Command {
    return { label: 'Move part', apply: (d) => setPartPose(d, id, pose) };
  },
  addLink(link: Link): Command {
    return { label: 'Connect', apply: (d) => addLink(d, link) };
  },
  removeLink(link: Link): Command {
    return { label: 'Disconnect', apply: (d) => removeLink(d, link) };
  },
};
