import { describe, expect, it } from "vitest";
import { initialProject } from "./project";
import { projectForEditor } from "./projectValidation";
import { LocalProjectSession, RevisionConflict, type LocalProject, type ProjectRepository } from "./localProjects";

function memoryRepository() {
  const records = new Map<string,LocalProject>();
  let fail = false;
  const repository:ProjectRepository = {
    async list() { return [...records.values()].map(({project,...meta}) => ({...meta,name:project.document.name,width:project.document.width,height:project.document.height,unit:project.document.unit})); },
    async read(id) { return structuredClone(records.get(id)); },
    async write(next, expected) {
      if (fail) throw new Error("Storage full");
      const previous=records.get(next.id);
      if ((previous?.revision ?? null) !== expected) throw new RevisionConflict();
      const saved={...next,revision:(expected??0)+1};
      records.set(next.id,structuredClone(saved));return saved;
    },
  };
  return {repository,records,setFail:(value:boolean)=>{fail=value;}};
}
const project=(name:string)=>({...structuredClone(initialProject),document:{...initialProject.document,name}});

describe("local project autosave sessions",()=>{
  it("rejects incomplete stored render settings before activating a project",()=>{
    const missingExport=project("Broken") as any;delete missingExport.export;
    const missingGuides=project("Broken") as any;missingGuides.document.guides=null;
    const missingPayload=project("Broken") as any;missingPayload.layers.find((layer:any)=>layer.type==="qr").payloadTemplate=null;
    for(const invalid of [missingExport,missingGuides,missingPayload])expect(()=>projectForEditor(invalid)).toThrow();
    expect(projectForEditor(project("Valid")).document.name).toBe("Valid");
  });
  it("keeps one local identity through edits without changing portable content",async()=>{
    const {repository,records}=memoryRepository(),session=new LocalProjectSession(repository);
    const first=project("First"); session.stage(first);await session.flush();
    const id=session.active!.id;
    const edited=project("Renamed");session.stage(edited);await session.flush();
    expect(records.size).toBe(1);expect(session.active!.id).toBe(id);expect(session.active!.revision).toBe(2);
    expect(records.get(id)!.project).toEqual(edited);expect(Object.keys(edited)).not.toContain("localId");
  });
  it("serializes rapid writes and commits the latest staged content",async()=>{
    const {repository,records}=memoryRepository(),session=new LocalProjectSession(repository);
    session.stage(project("One"));const first=session.flush();
    session.stage(project("Two"));const second=session.flush();
    session.stage(project("Three"));await Promise.all([first,second,session.flush()]);
    expect(records.size).toBe(1);expect([...records.values()][0].project.document.name).toBe("Three");expect(session.pending).toBe(false);
  });
  it("preserves the last committed snapshot on failure and retries newer edits",async()=>{
    const memory=memoryRepository(),session=new LocalProjectSession(memory.repository);
    session.stage(project("Saved"));await session.flush();const id=session.active!.id;
    memory.setFail(true);session.stage(project("Unsaved"));await expect(session.flush()).rejects.toThrow("Storage full");
    expect(session.pending).toBe(true);expect(memory.records.get(id)!.project.document.name).toBe("Saved");
    session.stage(project("Retry latest"));memory.setFail(false);await session.flush();
    expect(memory.records.get(id)!.project.document.name).toBe("Retry latest");expect(session.pending).toBe(false);
  });
  it("finishes an in-flight write before saving a newer edit",async()=>{
    const memory=memoryRepository(),write=memory.repository.write;
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    let started!:()=>void;const writing=new Promise<void>(resolve=>{started=resolve;});
    memory.repository.write=async(...args)=>{started();await gate;return write(...args);};
    const session=new LocalProjectSession(memory.repository);
    session.stage(project("In flight"));const pending=session.flush();await writing;
    expect(session.saving).toBe(true);expect(()=>session.activate()).toThrow(/pending/i);
    session.stage(project("Newest"));release();await pending;
    expect([...memory.records.values()][0].project.document.name).toBe("Newest");expect(session.active!.revision).toBe(2);
  });
  it("preserves an undo to the saved snapshot during a different in-flight save",async()=>{
    const memory=memoryRepository(),session=new LocalProjectSession(memory.repository),original=project("Original");
    session.stage(original);await session.flush();
    const write=memory.repository.write;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    let started!:()=>void;const writing=new Promise<void>(resolve=>{started=resolve;});
    memory.repository.write=async(...args)=>{started();await gate;return write(...args);};
    session.stage(project("Temporary"));const pending=session.flush();await writing;
    session.stage(original);release();await pending;
    expect([...memory.records.values()][0].project).toEqual(original);expect(session.active!.revision).toBe(3);
  });
  it("forks conflicting tab edits instead of overwriting a newer revision",async()=>{
    const {repository,records}=memoryRepository(),first=new LocalProjectSession(repository),second=new LocalProjectSession(repository);
    first.stage(project("Original"));await first.flush();const original=await repository.read(first.active!.id);
    second.activate(original!);first.stage(project("Tab one"));await first.flush();
    second.stage(project("Tab two"));await second.flush();
    expect(records.size).toBe(2);expect(first.active!.id).not.toBe(second.active!.id);
    expect([...records.values()].map(record=>record.project.document.name).sort()).toEqual(["Tab one","Tab two"]);
    expect(second.forked).toBe(true);
  });
  it("clears a failed-save message when undo returns to the committed snapshot",async()=>{
    const memory=memoryRepository(),session=new LocalProjectSession(memory.repository),original=project("Committed");
    session.stage(original);await session.flush();memory.setFail(true);
    session.stage(project("Failed edit"));await expect(session.flush()).rejects.toThrow();
    session.stage(original);await session.flush();
    expect(session.error).toBe("");expect(session.pending).toBe(false);expect(session.active!.revision).toBe(1);
  });
  it("switches to an existing identity only after pending work is flushed",async()=>{
    const {repository,records}=memoryRepository(),session=new LocalProjectSession(repository);
    session.stage(project("First"));expect(()=>session.activate()).toThrow(/pending/i);
    await session.flush();const first=await repository.read(session.active!.id);
    session.activate();session.stage(project("Second"));await session.flush();
    session.activate(first!);session.stage(project("First again"));await session.flush();
    expect(records.size).toBe(2);expect(records.get(first!.id)!.project.document.name).toBe("First again");
  });
  it("does not rewrite an unchanged reopened project",async()=>{
    const {repository}=memoryRepository(),session=new LocalProjectSession(repository);
    const content=project("Saved");session.stage(content);await session.flush();const stored=await repository.read(session.active!.id);
    session.activate(stored!);session.stage(stored!.project);await session.flush();expect(session.active!.revision).toBe(1);
  });
});
