"""Recover every pre-rendered movie from an SLUS_215.83 ISO opened read-only.
Run with --iso PATH. No PS2 executable is run. Requires Pillow/numpy via
convert_menu plus FFmpeg (or imageio_ffmpeg). H.264/AAC encodes preserve source
pixel dimensions, frame rate and stereo audio. Playback order is NOT inferred
from archive order. Original cutscenes using engine timelines are not videos.
"""
import argparse,hashlib,json,re,shutil,struct,subprocess,sys
from pathlib import Path
from convert_menu import Disc,Archive

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def sequence_evidence(exe):
    # The ELF's second LOAD segment maps file 0x3b000 to virtual 0x180000.
    # Record the source words, so this evidence is reproducible without a
    # disassembler dependency and can be checked against the original image.
    delta=0x145000
    def words(va,n):return list(struct.unpack_from('<'+'I'*n,exe,va-delta))
    def zstring(va):return exe[va-delta:].split(b'\0',1)[0].decode('ascii')
    movie_ptrs=words(0x5b37e8,5)
    names=[zstring(v) for v in movie_ptrs]
    switch=words(0x6187a0,5)
    if names!=['movies\\'+x+'_ps2_ntsc.bik' for x in ['dolby','radical','sierra','shadow','attract']]:raise ValueError('Unexpected movie lookup table')
    if switch!=[0x2a8154,0x2a8170,0x2a818c,0x2a81a8,0x2a81e8]:raise ValueError('Unexpected callback switch')
    transitions=[]
    for state,target in enumerate(switch[:3]):
        block=words(target,5)
        expected=state+1
        if block[0]!=(0x24020000|expected) or block[2]!=0xae020024 or block[3]!=0x0c0aa08c or block[4]!=(0x24050000|expected):raise ValueError('Unexpected movie callback code')
        transitions.append(dict(currentMovieIndex=state,nextMovieIndex=expected,nextMovie=names[expected],virtualAddress=hex(target),instructionWords=[hex(w) for w in block]))
    return dict(ntscLookupTable=dict(virtualAddress='0x5b37e8',fileOffset=hex(0x5b37e8-delta),names=names),completionCallback=dict(virtualAddress='0x2a8110',stateOffset='0x24',jumpTableVirtualAddress='0x6187a0',targets=[hex(v) for v in switch],transitions=transitions),normalCompletionChain=['dolby','radical','sierra','shadow'],confidence='Statically verified completion transitions; initial boot event selecting movie 0 has not been traced. This is not a hardware playback observation.')
def probe(ffmpeg,path):
    r=subprocess.run([ffmpeg,'-hide_banner','-i',str(path)],capture_output=True,text=True)
    s=r.stderr
    m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s)
    if not m:raise ValueError(s)
    duration=int(m[1])*3600+int(m[2])*60+float(m[3])
    v=re.search(r'Video: ([^, ]+).*?(\d{2,5})x(\d{2,5}).*?([\d.]+) fps',s)
    a=re.search(r'Audio: ([^, ]+)[^\n]*?, (\d+) Hz, ([^,\n]+)',s)
    if not v or not a:raise ValueError('Expected video and audio tracks: '+s)
    return dict(durationSeconds=duration,videoCodec=v[1],width=int(v[2]),height=int(v[3]),fps=float(v[4]),audioCodec=a[1],sampleRate=int(a[2]),channels=a[3].strip())

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--iso',required=True,type=Path)
    p.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[1]/'public/assets/video')
    p.add_argument('--scratch',type=Path,default=Path('work/opening-media'));p.add_argument('--ffmpeg',default=shutil.which('ffmpeg'))
    p.add_argument('--report',type=Path,default=Path('outputs/crash-analysis/opening-media.json'));args=p.parse_args()
    if not args.ffmpeg:
        import imageio_ffmpeg
        args.ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    args.out.mkdir(parents=True,exist_ok=True);args.scratch.mkdir(parents=True,exist_ok=True)
    disc=Disc(args.iso)
    try:
        arc=Archive(disc,'DEFAULT.RCF');entries=[]
        for name in sorted(arc.files):
            if not name.endswith('.bik'):continue
            raw=arc.read(name);stem=Path(name.replace('\\','/')).stem;src=args.scratch/(stem+'.bik');src.write_bytes(raw)
            source=probe(args.ffmpeg,src);out=args.out/(stem+'.mp4');poster=args.out/(stem+'.webp')
            command=[args.ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(src),'-map','0:v:0','-map','0:a:0','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(out)]
            subprocess.run(command,check=True)
            subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-y','-ss','3','-i',str(out),'-frames:v','1',str(poster)],check=True)
            output=probe(args.ffmpeg,out)
            if (source['width'],source['height'],source['channels'],source['sampleRate'])!=(output['width'],output['height'],output['channels'],output['sampleRate']):raise ValueError('Media track mismatch')
            if abs(source['durationSeconds']-output['durationSeconds'])>.1:raise ValueError('Duration mismatch')
            # Decode the full encoded result, including its audio, rather than only probing its header.
            subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-i',str(out),'-f','null','-'],check=True)
            frames,num,den=struct.unpack_from('<I',raw,8)[0],struct.unpack_from('<I',raw,28)[0],struct.unpack_from('<I',raw,32)[0]
            entries.append(dict(id=stem.removesuffix('_ps2_ntsc'),archive='DEFAULT.RCF',archivePath=name,archiveOffset=arc.files[name][0],sourceBytes=len(raw),sourceSha256=hashlib.sha256(raw).hexdigest(),source=source,sourceFrames=frames,sourceFrameRate=dict(numerator=num,denominator=den),url='/assets/video/'+out.name,poster='/assets/video/'+poster.name,outputBytes=out.stat().st_size,outputSha256=digest(out),output=output,verification='Full FFmpeg video/audio decode passed; track dimensions, stereo sample rate and duration checked.'))
            print(stem,source['durationSeconds'],out.stat().st_size,flush=True)
        exe=disc.read('SLUS_215.83')
        table=[]
        for m in re.finditer(rb'movies\\[^\x00]+_ntsc\.bik',exe):table.append(dict(fileOffset=hex(m.start()),value=m.group().decode()))
        report=dict(serial='SLUS_215.83',discAccess='read-only',movies=entries,sequence=dict(verifiedPlaybackOrder=None,executableMovieNameTable=table,warning='A filename table is not proof of execution order. Do not present its order as verified playback. Shadow is the 73-second shadow-puppet prologue, not the later real-time family/capture scene.',frontEndGraphEvidence=dict(archivePath='fighttrees\\Frontend.bfig',states=['BootUp','CheckMemoryCard','AutoSaveWarning','LicenseScreen','LoadPersistentPostBootUp','Movie','TitleScreen'],note='Graph has conditional branches; this is a state inventory, not a complete linear flow.')),loading=dict(source='SLUS_215.83 class-associated resource strings and front-end P3D resources',textKeys=['GameLoad_loading','GameLoad_Loading','EpisodeNumber','EpisodeName'],levelPresentationResources=['FE_Black','FE_Divider_Top.tga','FE_Divider_Bottom.tga','FE_Icon.tga'],loadingResources=['FE_Footprint.tga'],existingAssetCatalog='/assets/catalog.json',exactLayoutVerified=False),limitations=['Only five pre-rendered Bink movies exist in DEFAULT.RCF. Engine-rendered cinematic timelines require separate runtime implementation.','Aspect ratio preserves encoded pixels; PS2 display/pixel-aspect behavior has not been established from hardware.','Movie playback sequence, skip rules and loading-screen animation timing have not been verified.'])
        report['sequence']['staticExecutableEvidence']=sequence_evidence(exe)
        args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,indent=2),encoding='utf8')
        (args.out/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    finally:disc.file.close()
if __name__=='__main__':main()
