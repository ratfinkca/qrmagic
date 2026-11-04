import { describe, expect, it } from "vitest";
import { searchHelpArticles, readTourCompleted, markTourCompleted, TOUR_STORAGE_KEY } from "./helpContent";

describe("help discovery and preferences",()=>{
  it("finds print terminology regardless of case or extra spaces",()=>{
    expect(searchHelpArticles("  BLEED   edges ").map(article=>article.id)).toContain("print-setup");
    expect(searchHelpArticles("serial copies").map(article=>article.id)).toContain("quantities");
  });
  it("shows all topics for an empty search and no unrelated results",()=>{
    expect(searchHelpArticles("   ").length).toBeGreaterThan(5);
    expect(searchHelpArticles("unfindable-topic-123")).toEqual([]);
  });
  it("stores only a completion preference, independently of project files",()=>{
    const values=new Map<string,string>();
    const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
    expect(readTourCompleted(storage)).toBe(false);
    expect(markTourCompleted(storage)).toBe(true);
    expect(readTourCompleted(storage)).toBe(true);
    expect([...values.entries()]).toEqual([[TOUR_STORAGE_KEY,"complete"]]);
  });
  it("keeps help usable when browser storage is blocked",()=>{
    const storage={getItem:()=>{throw new Error("blocked");},setItem:()=>{throw new Error("blocked");}};
    expect(readTourCompleted(storage)).toBe(false);
    expect(markTourCompleted(storage)).toBe(false);
  });
});
