export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export type Page = {
  id: string;
  name: string;
  source: Blob;
  preview: string;
  width: number;
  height: number;
  corners?: Quad;
  rotation: number;
  status: "queued" | "processing" | "pending" | "done" | "error";
  mode: "quick" | "normal";
  result?: Blob;
  resultUrl?: string;
  notice?: string;
  error?: string;
};
