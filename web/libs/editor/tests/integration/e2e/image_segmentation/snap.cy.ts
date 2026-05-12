import { ImageView, Labels, LabelStudio } from "@humansignal/frontend-test/helpers/LSF";
import { snapConfig, snapImageData } from "../../data/image_segmentation/snap";

// The snap indicator's Konva Layer opacity is bound to its visibility state.
// Reading the Layer's opacity directly is a stable way to verify the cyan
// ring is being drawn without depending on a screenshot.
function snapIndicatorOpacity() {
  return cy.window().then((win: any) => {
    const stages = win.Konva?.stages ?? [];
    for (const s of stages) {
      const layer = s.findOne(".snap-indicator");
      if (layer) return layer.opacity();
    }
    return 0;
  });
}

// Helper: small offset (~6 canvas px) in drawingFrame-fraction space. With
// snapthreshold=12 in the config, this stays well inside the snap radius
// regardless of viewport size.
function fracOffset(): Cypress.Chainable<{ dx: number; dy: number }> {
  return ImageView.drawingFrame.then((el) => {
    const rect: DOMRect = el[0].getBoundingClientRect();
    return { dx: 6 / rect.width, dy: 6 / rect.height };
  });
}

// Click a polygon as separate real-click events. drawPolygonRelative uses
// synthetic mousedown/mouseup pairs, which work for closure detection but
// take a slightly different path through the polygon tool; use real clicks
// to mirror what an actual user does.
function drawPolygonByClicks(points: [number, number][], closeOnLast = true) {
  for (const [px, py] of points) ImageView.clickAtRelative(px, py);
  if (closeOnLast) ImageView.clickAtRelative(points[0][0], points[0][1]);
}

// Read the first vertex of the named-label region back from the serialized
// result. Returns null if the region is missing.
function firstVertexOf(labelValue: string) {
  return LabelStudio.serialize().then((results: any[]) => {
    const region = results.find(
      (r) => r.value?.polygonlabels?.[0] === labelValue || r.value?.vectorlabels?.[0] === labelValue,
    );
    if (!region) return null;
    // PolygonRegion serializes as { points: [[x, y], ...] };
    // VectorRegion serializes as { vertices: [{ x, y, ... }, ...] }.
    if (Array.isArray(region.value.points)) {
      const [x, y] = region.value.points[0];
      return { x, y };
    }
    if (Array.isArray(region.value.vertices)) {
      const v = region.value.vertices[0];
      return { x: v.x, y: v.y };
    }
    return null;
  });
}

beforeEach(() => {
  LabelStudio.params().config(snapConfig).data(snapImageData).withResult([]).init();
  LabelStudio.waitForObjectsReady();
  ImageView.waitForImage();
});

describe("Snap to vertex/edge", () => {
  it("snaps a new polygon's first vertex onto an existing vertex (shared snapgroup)", () => {
    // Draw an outline. Its exact internal coords depend on click→canvas
    // mapping; we don't care about the absolute coords, only that the dormer
    // lands on top of the outline's TL.
    Labels.select("outline");
    drawPolygonByClicks([
      [0.3, 0.3],
      [0.5, 0.3],
      [0.5, 0.5],
      [0.3, 0.5],
    ]);

    Labels.select("dormer");
    fracOffset().then(({ dx, dy }) => {
      drawPolygonByClicks([
        [0.3 + dx, 0.3 + dy],
        [0.4, 0.4],
        [0.35, 0.45],
      ]);
    });

    // Snap means: dormer's first vertex == outline's first vertex within a
    // very tight tolerance, despite the click being offset from it.
    firstVertexOf("outline").then((outlineTL) => {
      firstVertexOf("dormer").then((dormerTL) => {
        expect(outlineTL, "outline TL exists").to.not.be.null;
        expect(dormerTL, "dormer TL exists").to.not.be.null;
        expect(dormerTL!.x, "dormer x snapped to outline TL").to.be.closeTo(outlineTL!.x, 0.01);
        expect(dormerTL!.y, "dormer y snapped to outline TL").to.be.closeTo(outlineTL!.y, 0.01);
      });
    });
  });

  it("does NOT snap to a polygon in a different snapgroup", () => {
    Labels.select("outline");
    drawPolygonByClicks([
      [0.3, 0.3],
      [0.5, 0.3],
      [0.5, 0.5],
      [0.3, 0.5],
    ]);

    Labels.select("window");
    fracOffset().then(({ dx, dy }) => {
      drawPolygonByClicks([
        [0.3 + dx, 0.3 + dy],
        [0.4, 0.4],
        [0.35, 0.45],
      ]);
    });

    // No snap → window's first vertex sits at the click position, which is
    // visibly offset from the outline's TL.
    firstVertexOf("outline").then((outlineTL) => {
      firstVertexOf("window").then((windowTL) => {
        const dist = Math.hypot(windowTL!.x - outlineTL!.x, windowTL!.y - outlineTL!.y);
        expect(dist, "window stayed at click offset, did not snap").to.be.greaterThan(0.3);
      });
    });
  });

  it("snaps to a polygon edge midpoint (edge mode)", () => {
    Labels.select("outline");
    drawPolygonByClicks([
      [0.3, 0.3],
      [0.5, 0.3],
      [0.5, 0.5],
      [0.3, 0.5],
    ]);

    // Click below the top edge at mid-span. y should snap to the top edge's
    // y; x should remain near the click x.
    Labels.select("dormer");
    fracOffset().then(({ dy }) => {
      drawPolygonByClicks([
        [0.4, 0.3 + dy],
        [0.4, 0.4],
        [0.45, 0.4],
      ]);
    });

    firstVertexOf("outline").then((outlineTL) => {
      firstVertexOf("dormer").then((dormerTL) => {
        // The outline's top edge runs along outlineTL.y; the dormer's first
        // vertex should land on that y exactly.
        expect(dormerTL!.y, "dormer y snapped onto top edge").to.be.closeTo(outlineTL!.y, 0.01);
        // The dormer's x should NOT have collapsed to the outline TL — it
        // should stay near the click position (mid-edge).
        expect(Math.abs(dormerTL!.x - outlineTL!.x)).to.be.greaterThan(5);
      });
    });
  });

  it("shows the snap indicator while hovering near a snap target", () => {
    Labels.select("outline");
    drawPolygonByClicks([
      [0.3, 0.3],
      [0.5, 0.3],
      [0.5, 0.5],
      [0.3, 0.5],
    ]);

    Labels.select("dormer");

    // Hover ~4 px past the outline's TL without clicking.
    ImageView.drawingFrame.then((el) => {
      const rect: DOMRect = el[0].getBoundingClientRect();
      const x = 0.3 * rect.width + 4;
      const y = 0.3 * rect.height + 4;
      ImageView.drawingArea.scrollIntoView().trigger("mousemove", x, y, { eventConstructor: "MouseEvent" });
    });

    snapIndicatorOpacity().should("be.greaterThan", 0.5);
  });

  it("cross-tag: VectorLabels snap to an existing PolygonLabels vertex (shared snapgroup)", () => {
    Labels.select("outline");
    drawPolygonByClicks([
      [0.3, 0.3],
      [0.5, 0.3],
      [0.5, 0.5],
      [0.3, 0.5],
    ]);

    // Place a single vector vertex near the outline's TL — should snap onto it.
    Labels.select("inline");
    fracOffset().then(({ dx, dy }) => {
      ImageView.clickAtRelative(0.3 + dx, 0.3 + dy);
    });

    firstVertexOf("outline").then((outlineTL) => {
      firstVertexOf("inline").then((inlineV) => {
        expect(inlineV, "inline first vertex exists").to.not.be.null;
        expect(inlineV!.x, "inline x snapped to outline TL").to.be.closeTo(outlineTL!.x, 0.05);
        expect(inlineV!.y, "inline y snapped to outline TL").to.be.closeTo(outlineTL!.y, 0.05);
      });
    });
  });
});
