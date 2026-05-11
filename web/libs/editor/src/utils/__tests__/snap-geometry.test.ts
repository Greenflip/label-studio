/* global describe, test, expect */
import { nearestVertex, nearestEdgeProjection, findSnapTarget, parseSnapModes } from "../snap-geometry";

describe("nearestVertex", () => {
  test("returns the nearest vertex when one is within threshold", () => {
    const regions = [{ vertices: [{ x: 100, y: 100 }, { x: 200, y: 100 }], closed: false }];
    const result = nearestVertex({ x: 105, y: 102 }, regions, 10);
    expect(result).toEqual({ x: 100, y: 100 });
  });

  test("returns null when no vertex is within threshold", () => {
    const regions = [{ vertices: [{ x: 100, y: 100 }], closed: false }];
    const result = nearestVertex({ x: 200, y: 200 }, regions, 10);
    expect(result).toBeNull();
  });

  test("returns null when regions is empty", () => {
    const result = nearestVertex({ x: 50, y: 50 }, [], 10);
    expect(result).toBeNull();
  });

  test("picks the closest vertex when multiple are within threshold", () => {
    const regions = [
      { vertices: [{ x: 100, y: 100 }, { x: 110, y: 100 }], closed: false },
      { vertices: [{ x: 108, y: 100 }], closed: false },
    ];
    const result = nearestVertex({ x: 109, y: 100 }, regions, 10);
    expect(result).toEqual({ x: 108, y: 100 });
  });
});

describe("nearestEdgeProjection", () => {
  test("projects a point onto a horizontal edge", () => {
    const regions = [{ vertices: [{ x: 0, y: 100 }, { x: 200, y: 100 }], closed: false }];
    const result = nearestEdgeProjection({ x: 50, y: 95 }, regions, 10);
    expect(result).toEqual({ x: 50, y: 100 });
  });

  test("returns null when projection falls outside the segment", () => {
    const regions = [{ vertices: [{ x: 0, y: 100 }, { x: 50, y: 100 }], closed: false }];
    const result = nearestEdgeProjection({ x: 100, y: 100 }, regions, 10);
    expect(result).toBeNull();
  });

  test("returns null when perpendicular distance exceeds threshold", () => {
    const regions = [{ vertices: [{ x: 0, y: 100 }, { x: 200, y: 100 }], closed: false }];
    const result = nearestEdgeProjection({ x: 100, y: 200 }, regions, 10);
    expect(result).toBeNull();
  });

  test("closed polygon snaps to the wraparound edge", () => {
    const regions = [
      {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        closed: true,
      },
    ];
    const result = nearestEdgeProjection({ x: -2, y: 50 }, regions, 10);
    expect(result).toEqual({ x: 0, y: 50 });
  });

  test("open polyline does not snap to the wraparound segment", () => {
    const regions = [
      {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        closed: false,
      },
    ];
    const result = nearestEdgeProjection({ x: -2, y: 50 }, regions, 10);
    expect(result).toBeNull();
  });

  test("returns null for a region with a single vertex", () => {
    const regions = [{ vertices: [{ x: 50, y: 50 }], closed: false }];
    const result = nearestEdgeProjection({ x: 50, y: 50 }, regions, 10);
    expect(result).toBeNull();
  });

  test("picks the nearest edge across multiple regions", () => {
    const regions = [
      { vertices: [{ x: 0, y: 100 }, { x: 200, y: 100 }], closed: false },
      { vertices: [{ x: 0, y: 90 }, { x: 200, y: 90 }], closed: false },
    ];
    const result = nearestEdgeProjection({ x: 50, y: 92 }, regions, 10);
    expect(result).toEqual({ x: 50, y: 90 });
  });
});

describe("findSnapTarget", () => {
  const square = {
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    closed: true,
  };

  test("vertex mode returns nearest vertex and ignores edges", () => {
    const result = findSnapTarget({ x: 3, y: 3 }, [square], 10, { vertex: true });
    expect(result).toEqual({ x: 0, y: 0 });
  });

  test("edge mode returns edge projection and ignores vertices", () => {
    const result = findSnapTarget({ x: 50, y: 3 }, [square], 10, { edge: true });
    expect(result).toEqual({ x: 50, y: 0 });
  });

  test("combined mode: vertex wins when both are within threshold", () => {
    const result = findSnapTarget({ x: 3, y: 3 }, [square], 10, { vertex: true, edge: true });
    expect(result).toEqual({ x: 0, y: 0 });
  });

  test("combined mode: falls through to edge when no vertex within threshold", () => {
    const result = findSnapTarget({ x: 50, y: 3 }, [square], 10, { vertex: true, edge: true });
    expect(result).toEqual({ x: 50, y: 0 });
  });

  test("returns null when neither mode is enabled", () => {
    const result = findSnapTarget({ x: 3, y: 3 }, [square], 10, {});
    expect(result).toBeNull();
  });

  test("returns null when nothing is within threshold", () => {
    const result = findSnapTarget({ x: 500, y: 500 }, [square], 10, { vertex: true, edge: true });
    expect(result).toBeNull();
  });
});

describe("parseSnapModes", () => {
  test('"none" yields an empty set of modes', () => {
    expect(parseSnapModes("none")).toEqual({});
  });

  test('"" yields an empty set of modes', () => {
    expect(parseSnapModes("")).toEqual({});
  });

  test('"pixel" yields pixel-only', () => {
    expect(parseSnapModes("pixel")).toEqual({ pixel: true });
  });

  test('"vertex" yields vertex-only', () => {
    expect(parseSnapModes("vertex")).toEqual({ vertex: true });
  });

  test('"vertex,edge" yields both', () => {
    expect(parseSnapModes("vertex,edge")).toEqual({ vertex: true, edge: true });
  });

  test("tolerates whitespace and casing", () => {
    expect(parseSnapModes(" Vertex , EDGE ")).toEqual({ vertex: true, edge: true });
  });

  test("ignores unknown tokens", () => {
    expect(parseSnapModes("vertex,banana")).toEqual({ vertex: true });
  });
});
