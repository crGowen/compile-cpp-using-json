import { exec } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

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

    const dlls:string = build.dll.replaceAll("/", "\\")
        .split("\\")
        .slice(0, -1)
        .join()
        + "\\*.dll";
        
    const include:string = build.include.replaceAll("/", "\\");

    const hRaw:string = build.hFile && readFileSync(build.hFile, 'utf8');

    const hFile = hRaw.replaceAll('__declspec(dllexport)', '__declspec(dllimport)');

    const out:string = build.output.replaceAll("/", "\\");

    runCommand(cpps, include, links, dlls, flags, out, hFile, dryRun);

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

function runCommand(cpps: string, include:string, links:string, dlls:string, flags: string, out:string, hFile:string, dryRun: boolean): void {
    const outDir = out.split("\\").slice(0, -1).join('\\');
    const outName = out.split("\\").slice(-1).join('').split('.')[0];
    const filetypeRaw = out.split(".").slice(-1)[0];
    const fileType = filetypeRaw === 'exe' || filetypeRaw === 'dll' ? filetypeRaw : 'exe';

    const includeCmd = include ? `/I ${include}` : "";
    const dllFlag = fileType === 'dll' ? "/LD" : "";
    const cleanUpDllStuff = dllFlag ? `& cd ${outDir} && del *.exp` : ""; 
    const copyDllsCmd = dlls ? `&& echo D | xcopy /y ${dlls} ${outDir}` : "";

    const res =`mkdir ${outDir} & cl ${cpps} ${links} ${includeCmd} ${flags} ${dllFlag} /Fe: ${out} ${copyDllsCmd} & del *.obj ${cleanUpDllStuff}`;

    const doCompile = () => exec(res, (_, stdout) => {
        console.log(stdout);
        const hFileOutDir = outDir + '\\' + outName + ".h";
        if (hFile) writeFileSync(hFileOutDir, hFile);
    });        

    dryRun
    ? console.log(res)
    : doCompile();
};