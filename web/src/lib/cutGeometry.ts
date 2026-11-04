import type { ShapeGeometry } from "../types";
import { polygonPath } from "./shapeGeometry";

/** Shared by cut-reference exports and the browser's quality-check geometry. */
export function outlinePath(width:number,height:number,shape:ShapeGeometry):string {
  if(shape.shape==="ellipse")return `M 0 ${height/2} A ${width/2} ${height/2} 0 1 0 ${width} ${height/2} A ${width/2} ${height/2} 0 1 0 0 ${height/2} Z`;
  if(shape.shape!=="rectangle"&&shape.shape!=="pill")return polygonPath(width,height,shape);
  const radius=shape.shape==="pill"?Math.min(width,height)/2:Math.max(0,Math.min(shape.cornerRadius,width/2,height/2));
  if(!radius)return `M 0 0 H ${width} V ${height} H 0 Z`;
  const arc=`A ${radius} ${radius} 0 0 1`;
  return `M ${radius} 0 H ${width-radius} ${arc} ${width} ${radius} V ${height-radius} ${arc} ${width-radius} ${height} H ${radius} ${arc} 0 ${height-radius} V ${radius} ${arc} ${radius} 0 Z`;
}
