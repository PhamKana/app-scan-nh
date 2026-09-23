import type { Quad } from "./types";
import {
  fullQuad as full,
  validQuad as valid,
  rotateQuad as rotate,
} from "../public/geometry.mjs";
export const fullQuad = full as (w: number, h: number) => Quad;
export const validQuad = valid as (p: Quad, w: number, h: number) => boolean;
export const rotateQuad = rotate as (p: Quad, h: number) => Quad;
