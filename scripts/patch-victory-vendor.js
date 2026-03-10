#!/usr/bin/env bun
// Patches victory-vendor/es/d3-scale.js to work around a Bun HTML bundler bug:
// `export * from "d3-scale"` drops re-exported defaults (`export { default as scaleLinear }`).
// This replaces the barrel re-export with explicit named imports from d3-scale.

const path = "node_modules/victory-vendor/es/d3-scale.js";
const patched = `// victory-vendor/d3-scale (ESM) — patched for Bun bundler compatibility
import {
  scaleBand, scalePoint, scaleIdentity, scaleLinear, scaleLog, scaleSymlog,
  scaleOrdinal, scaleImplicit, scalePow, scaleSqrt, scaleRadial,
  scaleQuantile, scaleQuantize, scaleThreshold, scaleTime, scaleUtc,
  scaleSequential, scaleSequentialLog, scaleSequentialPow, scaleSequentialSqrt, scaleSequentialSymlog,
  scaleSequentialQuantile,
  scaleDiverging, scaleDivergingLog, scaleDivergingPow, scaleDivergingSqrt, scaleDivergingSymlog,
  tickFormat
} from "d3-scale";
export {
  scaleBand, scalePoint, scaleIdentity, scaleLinear, scaleLog, scaleSymlog,
  scaleOrdinal, scaleImplicit, scalePow, scaleSqrt, scaleRadial,
  scaleQuantile, scaleQuantize, scaleThreshold, scaleTime, scaleUtc,
  scaleSequential, scaleSequentialLog, scaleSequentialPow, scaleSequentialSqrt, scaleSequentialSymlog,
  scaleSequentialQuantile,
  scaleDiverging, scaleDivergingLog, scaleDivergingPow, scaleDivergingSqrt, scaleDivergingSymlog,
  tickFormat
};
`;

await Bun.write(path, patched);
console.log("Patched victory-vendor/es/d3-scale.js for Bun bundler compatibility");
