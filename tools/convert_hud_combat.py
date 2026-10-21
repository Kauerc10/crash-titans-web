"""Recover HUD art, base health, and explicit attack windows without executing PS2 code."""
import sys,json,re,struct
from pathlib import Path
from convert_menu import Disc,Archive,image_assets
from source_templates import template_data
from p3d import chunks,walk,string
from PIL import Image,ImageFilter

def convert(iso):
    arc=Archive(Disc(iso),'DEFAULT.RCF');out=Path('outputs/crash-menu/public/assets/hud');out.mkdir(exist_ok=True)
    hud_source='package\\7a8185b0.p3d';image_assets(chunks(arc.read(hud_source)),out)
    catalog=json.loads((out/'catalog.json').read_text())
    # The first128 texels are the base-health segment. The two64px tails
    # belong to health upgrades; they must not be shown at base90 HP.
    entry=catalog['hud_health_meter.tga'];im=Image.open(out/entry['file']).convert('RGBA');base=im.crop((0,0,128,32))
    from PIL import ImageDraw,ImageChops
    background=Image.open(out/catalog['hud_health_meter_background.tga']['file']).convert('RGBA')
    alpha=background.getchannel('A');region=alpha.point(lambda value:255 if value>=32 else 0)
    border=[(x,y) for x in range(region.width) for y in [0,region.height-1]]+[(x,y) for y in range(region.height) for x in [0,region.width-1]]
    for point in border:
        if region.getpixel(point)==0:ImageDraw.floodfill(region,point,128)
    interior=region.point(lambda value:255 if value==0 else 0)
    left,_,right,_=interior.getbbox();frame_right=alpha.getbbox()[2]
    assert frame_right==102 and (left,right)==(5,98)
    frame=background.crop((0,0,frame_right,32));frame.save(out/'health-frame.webp',lossless=True)
    empty=Image.new('RGBA',background.size,(32,17,8,0));empty.putalpha(interior);empty.crop((0,0,frame_right,32)).save(out/'health-empty.webp',lossless=True)
    # Keep the gold rim and spiral above the black backing; masking to its
    # enclosed hole erased the original colored contour.
    silhouette=region.point(lambda value:0 if value==128 else 255)
    color=base.copy();color.putalpha(ImageChops.multiply(silhouette,base.getchannel('A')))
    color.crop((0,0,frame_right,32)).save(out/'health-fill.webp',lossless=True)
    geometry=dict(frameWidth=frame_right,frameHeight=32,fillLeft=0,fillWidth=frame_right)
    Path('outputs/crash-menu/src/health-meter-geometry.js').write_text('// Generated from the enclosed source frame; upgrade extensions excluded.\nexport const healthMeterGeometry='+json.dumps(geometry)+';\n')
    symbol=Image.open(out/catalog['hud_symbol.tga']['file']).convert('RGBA');shade=symbol.getchannel('A');coverage=shade.point(lambda v:min(255,v*6))
    colored=Image.new('RGBA',symbol.size,(22,14,8,0));colored.putalpha(coverage.filter(ImageFilter.MaxFilter(3)))
    fill=Image.new('RGBA',symbol.size)
    for y in range(symbol.height):
        for x in range(symbol.width):
            light=.76+.24*shade.getpixel((x,y))/255
            fill.putpixel((x,y),(int(243*light),int((122-y*35/symbol.height)*light),4,coverage.getpixel((x,y))))
    colored=Image.alpha_composite(colored,fill);colored.save(out/'crash-symbol.webp',lossless=True)
    combo=Image.open(out/catalog['hud_combo_counter_splash.tga']['file']).convert('RGBA');green=Image.new('RGBA',combo.size,(34,255,16,0));green.putalpha(combo.getchannel('A'));green.save(out/'combo-green.webp',lossless=True)
    templates=template_data(arc);rules={}
    for name,key in [('player','Characters:Crash'),('enemy','Characters:Chiratta')]:
        rule=templates[key];rules[name]={'maxHealth':rule['fields']['m_DamageableBehaviour_current_hitpoints_max_number'],'evidence':rule}
    clips={}
    for c in walk(chunks(arc.read('package\\bca1bc0b.p3d'))+chunks(arc.read('package\\aadd6163.p3d'))):
        if c.id==0x121000:
            name,p=string(c.data,4);frames,fps=struct.unpack_from('<ff',c.data,p+4);clips[name]=dict(frames=frames,fps=fps)
    rules['attacks']={};rules['durations']={}
    for clip,path in [(f'PTRN_crash_attack_lite_{letter}','fighttrees\\Crash.bfig') for letter in 'ABC']+[('PTRN_chiratta_attack_light','fighttrees\\Fodder.bfig')]:
        raw=arc.read(path);start=raw.index(clip.encode()+b'\0');end=raw.find(b'PTRN_',start+len(clip));segment=raw[start:end if end!=-1 else len(raw)];strikes=[]
        pattern=rb'self:Attack\(\s*true,\s*\[\[([^\]]+)\]\],\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)'
        for match in re.finditer(pattern,segment):
            offset=start+match.start();assert raw[offset-16:offset-12]==bytes.fromhex('537c6dae'),(path,offset)
            first,last=struct.unpack_from('<ff',raw,offset-12);fps=clips[clip]['fps'];assert 0<=first<=last<clips[clip]['frames']
            strikes.append(dict(volume=match[1].decode(),strength=float(match[2]),damage=float(match[3]),power=float(match[4]),start=first/fps,end=last/fps,frames=[first,last],fps=fps,source=path,byteOffset=offset,call=raw[offset:raw.index(b'\n',offset)].decode().strip()))
        assert strikes,(clip,path)
        if clip=='PTRN_chiratta_attack_light':
            cooldown=re.search(rb'self:SetAttackCooldown\(\s*([\d.]+)',segment);assert cooldown;rules['enemy']['attackCooldown']=float(cooldown[1])
        key=clip.removeprefix('PTRN_crash_').removeprefix('PTRN_chiratta_');rules['attacks'][key]=strikes;rules['durations'][key]=(clips[clip]['frames']-1)/clips[clip]['fps']
    rules['limitations']=['Base template values only; difficulty/upgrades/native damage modifiers are not evaluated.','Attack volumes remain a native forward reach check; wrist/ankle source volumes are not yet driven by bone collision.','Invulnerability, combo input grace, stagger and pursuit remain approximate.','HUD placement and show/hide animation are reconstructed; original art is preserved.']
    (out/'combat-source.json').write_text(json.dumps(rules,indent=2))
    (Path('outputs/crash-menu/src')/'combat-rules.js').write_text('// Generated by tools/convert_hud_combat.py from the local PS2 disc.\nexport const combatRules='+json.dumps({k:rules[k] for k in ['player','enemy','attacks','durations']},separators=(',',':'))+';\n')
    manifest=dict(source=hud_source,canvas=[640,480],images=catalog,healthFill=dict(file='health-fill.webp',source=entry['file'],crop=[0,0,frame_right,32],geometry=geometry,interior='source silhouette including gold rim; fill above backing'),limitations=rules['limitations'])
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2));print('HUD images',len(catalog),'health',rules['player']['maxHealth'],rules['enemy']['maxHealth']);print(json.dumps(rules['attacks'],indent=2))

if __name__=='__main__':convert(sys.argv[1])
