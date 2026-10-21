"""Convert evidenced episode-one props and mojo, retaining state visibility and rules."""
import sys,json,struct,copy
from pathlib import Path
from convert_menu import Disc,Archive
from p3d import chunks,walk,string
from character_nis import convert
from source_templates import template_data

def export(iso):
    root=Path('outputs/crash-menu/public/assets');arc=Archive(Disc(iso),'DEFAULT.RCF');templates=template_data(arc)
    logic=json.loads((root/'levels/l1-e1/logic.json').read_text());definitions={};placements=[]
    # These thresholds come from source state attributes, not native attack damage.
    specs=[('plant-small','L1:sp_Whumpa_plantSmall','6f1f1239',1,0,'leaf'),
           ('plant-pot','L1:sp_Whumpa_plantPot','9a5ad407',1,0,'pot'),
           ('mailbox','L1:sp_Whumpa_mailbox','74fa80f7',1,0,'wood'),
           ('plant-large','L1:sp_Whumpa_plantLarge','6eb7386d',3,15,'leaf'),
           ('crate-mh','global:sp_crateMH','9b321a18',5,0,'metal'),
           ('crate-large','global:sp_crateLarge','4b698d7e',1,15,'wood')]
    for kind,template,hashed,hits,strength,sound in specs:
        template='StateProps:'+template;source=f'package\\{hashed}.p3d';tree=chunks(arc.read(source));actor=template.split(':')[-1];states=[]
        for c in walk(tree):
            if c.id!=0x8020009:continue
            name,at=string(c.data);header=struct.unpack_from('<6If4I',c.data,at);visibility={};attributes={};controllers=[];events={}
            for child in c.children:
                if child.id==0x8020002:
                    shape,p=string(child.data);visibility[shape]=struct.unpack_from('<I',child.data,p)[0]
                elif child.id==0x8020008:
                    key,p=string(child.data);value,_=string(child.data,p);attributes[key]=value
                elif child.id==0x8020003:
                    controller,p=string(child.data);enabled,cycles,hold,start,end,speed=struct.unpack_from('<IIIfff',child.data,p);controllers.append(dict(name=controller,enabled=bool(enabled),cycles=cycles,start=start,end=end,speed=speed,fps=30,dataHex=child.data[p:].hex()))
                elif child.id==0x8020004:
                    event,p=string(child.data);target,event_id=struct.unpack_from('<II',child.data,p);events[event]=target
            states.append(dict(name=name,visibility=visibility,attributes=attributes,controllers=controllers,events=events,auto=bool(header[0]),next=header[1],duration=header[6]/30))
        idle=states[0];broken=states[-1];models={}
        visibility_models={}
        for state in states:
            shapes=[name for name,value in state['visibility'].items() if value]
            if not shapes:state['model']=None;continue
            key=tuple(sorted(shapes))
            if key in visibility_models:
                state['model']=visibility_models[key];continue
            dest=root/'props'/kind/state['name'];convert(iso,dest,source_paths=[source],actor_names=[actor],shape_names=shapes,resource_paths=['package\\L1_E1\\fae145d6.p3d'])
            report=json.loads((dest/'actors.json').read_text());assert not report['errors'],report['errors']
            record=next(a for a in report['actors'] if a['name']==actor);models[state['name']]=f'/assets/props/{kind}/{state["name"]}/{record["file"]}';state['model']=models[state['name']];visibility_models[key]=state['model']
        rule=templates[template];fields=rule['fields'];drops=[];deferred=[]
        for i in range(1,4):
            target=fields.get(f'm_SpawnerBehaviour_generator_object_{i}_gameobject','');count=fields.get(f'm_SpawnerBehaviour_num_to_generate_{i}_number',0)
            if target and count>0:drops.append(dict(type=target.split(':')[-1],count=int(count)))
            elif target and count<0:deferred.append(dict(type=target.split(':')[-1],sourceCount=count,reason='Negative count uses an unimplemented probabilistic source convention.'))
        boxes=[]
        for c in walk(tree):
            if c.id==0x701000a and len(c.data)==36 and struct.unpack_from('<I',c.data)[0]==5:
                values=struct.unpack_from('<6f',c.data,12);boxes.append([list(values[:3]),list(values[3:])])
        definitions[kind]=dict(template=template,source=source,actor=actor,states=states,models=models,idle=idle['name'],broken=broken['name'],hits=hits,finalStrength=strength,sound=sound,drops=drops,deferredDrops=deferred,sourceRule=rule,collisionBoxes=boxes)
        for prop in logic['props']:
            if prop['template']!=template or prop['script']!='props_normal':continue
            placements.append(dict(id=prop['name'],kind=kind,position=prop['position'],rotation=prop['sourceRotation']['vector'],scale=prop['sourceScale']['vector']))
    # Actual S/M/L/XL mesh actors are in Crash's shared package; TEMP is a different billboard asset.
    dest=root/'collectables/mojo';names=['c_mojoS','c_mojoM','c_mojoL','c_mojoXL']
    convert(iso,dest,source_paths=['package\\bca1bc0b.p3d'],actor_names=names)
    report=json.loads((dest/'actors.json').read_text());assert not report['errors'],report['errors'];values={}
    for name in names:
        rule=templates['Collectables:'+name];fields=rule['fields'];record=next(a for a in report['actors'] if a['name']==name)
        values[name]=dict(value=fields['m_CollectableBehaviour_value_number'],model='/assets/collectables/mojo/'+record['file'],sourceRule=rule)
    pickups=[dict(id=p['name'],type=p['template'].split(':')[-1],position=p['position'],scale=p['sourceScale']['vector']) for p in logic['props'] if p['template'].split(':')[-1] in values and p['script']=='props_normal']
    result=dict(definitions=definitions,placements=placements,pickupTypes=values,pickups=pickups,limitations=['Native reach, hit timing, attraction, scatter and pickup radius are approximate.','Large plant third stage and large crate require source strength 15; Crash light attacks cannot finish them.','Original particle simulation, probabilistic health drops and persistent save are pending. Source frame ranges are sampled with native interpolation.','Timed explosive crates and the reloadable health crate are not included.'])
    (root/'props/episode-one.json').write_text(json.dumps(result,indent=2));print('INTERACTIONS',len(placements),'props',len(pickups),'placed mojo')

if __name__=='__main__':export(sys.argv[1])
