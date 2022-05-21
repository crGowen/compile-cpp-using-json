import { exec } from 'child_process';
import { readFileSync } from 'fs';

type BuildProfile = {
    cppDirs: string[];
    flags: string[];
    include: string;
    lib: string;
    dll: string;
    hFile: string;
    output: string;
};

const dryRun = process.argv[2] === 'dry-run';

run(dryRun);

function run(dryRun: boolean): void {
    const fileData:string = readFileSync('./build.json', 'utf8');
    const build: BuildProfile = JSON.parse(fileData);

    if (!verifyBuildFile(build)) {
        console.log("Invalid build file!");
        return;
    };

    const cpps:string = build.cppDirs.map(x => x.replaceAll("/", "\\"))
        .map(x => x[-1] === "\\" ? x.slice(0,1) : x)
        .map(x => x + '\\*.cpp')
        .join(" ");

    const flags:string = build.flags.map(x => x[0] && x[0] === "/" ? x : "/" + x)
        .join(" ");

    const lib:string = build.lib.replaceAll("/", "\\");
    const links:string = lib ? lib + "\\*.lib" : "";

    const dlls:string = build.dll.replaceAll("/", "\\");
        
    const include:string = build.include.replaceAll("/", "\\");

    const hFile:string = build.hFile.replaceAll("/", "\\");

    const out:string = build.output.replaceAll("/", "\\");

    const res = generateCommand(cpps, include, links, dlls, flags, out, hFile);

    dryRun
        ? console.log(res)
        : exec(res, (_, stdout) => console.log(stdout));
};

function verifyBuildFile(buildFile: BuildProfile): buildFile is BuildProfile {
    const checkStrArry = (x:any, required = false) =>  Array.isArray(x) && ((!required && !x.length) || typeof x[0] === "string");
    const checkStrs = (x:any[]) => x.reduce((prev: boolean, curr: any) => prev && typeof curr === "string", true);

    return checkStrArry(buildFile.cppDirs, true)
        && checkStrArry(buildFile.flags)
        && checkStrs([
            buildFile.dll,
            buildFile.lib,
            buildFile.hFile,
            buildFile.include,
            buildFile.output
        ]);
};

function generateCommand(cpps: string, include:string, links:string, dlls:string, flags: string, out:string, hFile:string): string {
    const outDir = out.split("\\").slice(0, -1).join('\\');
    const filetypeRaw = out.split(".").slice(-1)[0];
    const fileType = filetypeRaw === 'exe' || filetypeRaw === 'dll' ? filetypeRaw : 'exe';

    const includeCmd = include ? `/I ${include}` : "";
    const dllFlag = fileType === 'dll' ? "/LD" : "";
    const cleanUpDllStuff = dllFlag ? `& cd ${outDir} && del *.exp` : ""; 
    const copyHeadCmd = hFile ? `&& echo D | xcopy /y ${hFile} ${outDir}` : "";
    const copyDllsCmd = dlls ? `&& echo D | xcopy /y ${dlls} ${outDir}` : "";

    return `mkdir ${outDir} & cl ${cpps} ${links} ${includeCmd} ${flags} ${dllFlag} /Fe: ${out} ${copyHeadCmd} ${copyDllsCmd} & del *.obj ${cleanUpDllStuff}`;
};