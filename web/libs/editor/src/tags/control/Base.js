import { getRoot, types } from "mobx-state-tree";
import { FF_DEV_3391, isFF } from "../../utils/feature-flags";
import { BaseTag } from "../TagBase";
import { SNAP_TO_PIXEL_MODE } from "../../components/ImageView/Image";
import { findSnapTarget, parseSnapModes } from "../../utils/snap-geometry";

const ControlBase = types
  .model({
    ...(isFF(FF_DEV_3391)
      ? {
          id: types.identifier,
          name: types.string,
        }
      : {
          name: types.identifier,
        }),
    smart: true,
    smartonly: false,
    isControlTag: true,
  })
  .volatile(() => ({
    snapMode: SNAP_TO_PIXEL_MODE.EDGE,
  }))
  .views((self) => ({
    // historically two "types" were used and we should keep that backward compatibility:
    // 1. name of control tag for describing labeled region;
    // 2. label type to attach corresponding value to this region.
    // usually they are the same, but with some problems:
    // a. for hypertextlabels label type should be "htmllabels";
    // original type are overwritten by Tree#buildData with real tag name,
    // so _type was introduced to contain desired result type;
    // b. but for textarea they differ from each other: "textarea" and "text".
    // so now there is simple way to distinguish and overwrite them via two methods:
    get resultType() {
      return self.type;
    },

    // and
    get valueType() {
      return self.type;
    },

    get toNameTag() {
      return self.annotation.names.get(self.toname);
    },

    selectedValues() {
      throw new Error("Control tag needs to implement selectedValues method in views");
    },

    get result() {
      return self.annotation.results.find((r) => r.from_name === self);
    },

    get hasGeometrySnap() {
      const modes = parseSnapModes(self.snap);
      return Boolean(modes.vertex || modes.edge);
    },

    // Returns the snap target for a point (in internal coords) if one is in
    // range, otherwise null. Pure read of geometry — does not commit anything.
    getSnapTarget(point) {
      const modes = parseSnapModes(self.snap);
      if (!modes.vertex && !modes.edge) return null;
      const currentGroups = collectGroups(self.selectedLabels);
      if (currentGroups.size === 0) return null;
      const candidates = collectSnapCandidates(self.toNameTag, currentGroups);
      const threshold = screenPxToInternal(self.toNameTag, Number(self.snapthreshold) || 8);
      return findSnapTarget(point, candidates, threshold, modes);
    },

    getSnappedPoint(point) {
      const target = self.getSnapTarget(point);
      if (target) return target;
      const modes = parseSnapModes(self.snap);
      if (modes.pixel) return self.toNameTag.snapPointToPixel(point, self.snapMode);
      return point;
    },

    get smartEnabled() {
      const smart = self.smart ?? false;
      const autoAnnotation = getRoot(self)?.autoAnnotation ?? false;

      // @todo: Not sure why smartonly ignores autoAnnotation; It was like this from the beginning
      return (autoAnnotation && smart) || self.smartonly || false;
    },
  }));

function collectGroups(labels) {
  const out = new Set();
  if (!labels) return out;
  for (const label of labels) {
    if (label?.snapgroup) out.add(label.snapgroup);
  }
  return out;
}

function collectSnapCandidates(image, currentGroups) {
  const regions = image?.regs;
  if (!Array.isArray(regions) || regions.length === 0) return [];
  const out = [];
  for (const region of regions) {
    const regionGroups = new Set();
    for (const result of region.results ?? []) {
      for (const label of result.selectedLabels ?? []) {
        if (label?.snapgroup) regionGroups.add(label.snapgroup);
      }
    }
    let overlap = false;
    for (const g of regionGroups) {
      if (currentGroups.has(g)) {
        overlap = true;
        break;
      }
    }
    if (!overlap) continue;

    if (Array.isArray(region.points) && region.points.length) {
      // PolygonRegion stores points in internal percentage coords (0-100)
      out.push({
        vertices: region.points.map((p) => ({ x: p.x, y: p.y })),
        closed: region.closed ?? true,
      });
    } else if (Array.isArray(region.vertices) && region.vertices.length) {
      // VectorRegion stores vertices in image-pixel coords; normalize to internal
      const toInternal =
        typeof image.imageToInternalX === "function" && typeof image.imageToInternalY === "function"
          ? (v) => ({ x: image.imageToInternalX(v.x), y: image.imageToInternalY(v.y) })
          : (v) => ({ x: v.x, y: v.y });
      out.push({
        vertices: region.vertices.map(toInternal),
        closed: region.closed ?? false,
      });
    }
  }
  return out;
}

// Convert a screen-pixel length to internal-coord length, accounting for
// the image's current zoom so the snap radius stays constant in screen px.
function screenPxToInternal(image, screenPx) {
  if (!image) return screenPx;
  const zoomScale = image.zoomScale || 1;
  const unzoomed = screenPx / zoomScale;
  return typeof image.canvasToInternalX === "function" ? image.canvasToInternalX(unzoomed) : unzoomed;
}

export default types.compose(ControlBase, BaseTag);
