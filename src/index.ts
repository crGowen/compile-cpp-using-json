import { exec } from 'child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';

type BuildProfile = {
    "cppFiles": string[];
    "include": string[];
    "hFile": string;
    "flags": string[];
    "output": string;
};

const dryRun = process.argv[2];

run(dryRun);

function run(dryRun: string | undefined): void {
    const fileData:string = readFileSync('./build.json', 'utf8');
    const build: BuildProfile = JSON.parse(fileData);

    if (!verifyBuildFile(build)) {
        console.log("Invalid build file!");
        return;
    };

    const cppFolders:string[] = build.cppFiles.map(x =>generatePaths(x)).flat().map(x => x + '/*.cpp');
    const includes:string[] = build.include.map(x => x[-1] === "/" ? x.slice(0,1) : x);
    const flags:string[] = parseFlags(build.flags);

    const res = generateCommand(cppFolders, includes, flags, build.output, build.hFile);

    dryRun !== 'dry-run'
        ? exec(res, (_, stdout) => console.log(stdout))
        : console.log(res);
}

function verifyBuildFile(buildFile: BuildProfile): buildFile is BuildProfile {
    return Array.isArray(buildFile.cppFiles)
        && typeof buildFile.cppFiles[0] === "string"
        && Array.isArray(buildFile.include)
        && (!buildFile.include.length || typeof buildFile.include[0] === "string")
        && Array.isArray(buildFile.flags)
        && (!buildFile.flags.length || typeof buildFile.flags[0] === "string")
        && typeof buildFile.hFile === "string"
        && typeof buildFile.output === "string";
}

function getFolders(path: string): string[] {
    return existsSync(path) && statSync(path).isDirectory() ? readdirSync(path).filter( f => statSync(`${path}/${f}`).isDirectory() ) : [];
};

function getFoldersRecursive(path: string): string[] {
    const foundFolders: string[] = getFolders(path).map(x => `${path}/${x}`);

    const subFolders: string[] = foundFolders.map(f => getFoldersRecursive(f)).flat();
    return [...foundFolders, ...subFolders];
};

function generatePaths (path: string): string[] {
    const arr:string[] = path.split('**');  
    const pre:string = arr[0].slice(-1) === "/" ? arr[0].slice(0, -1) : arr[0];  
    
    const paths:string[] =  arr.length === 1
        ? [pre]
        : [pre, ...getFoldersRecursive(pre)];

    return paths;
};

function generateCommand(cppsInput: string[], inclInput:string[], flInput: string[], out:string, head:string): string {
    const cpps = cppsInput.join(" ");
    const incl = (inclInput || []).map(x => x.slice(-1) === "/" ? x.slice(0, -1) : x).join(" ");
    const fl = (flInput).join(" ");
    const output = out.replaceAll("/", '\\');
    const outDir = output.split('\\').slice(0, -1).join('\\');

    const inclCmd = incl ? `/I ${incl}` : '';

    const copyHeadCmd = false && head ? `& echo D | xcopy ${head} ${outDir}` : "";
    return `cl ${cpps} ${inclCmd} ${fl} /Fe: ${output} ${copyHeadCmd} & del *.obj`;
};

function parseFlags(fl: string[]) {
    if (fl.length < 1) return ['/EHsc'];

    const newFlags = fl.map(x => x[0] && x[0] === "/" ? x : "/" + x);
    const i = newFlags.indexOf('/default');
    if (i !== -1) newFlags[i] = '/EHsc';

    return newFlags;
}