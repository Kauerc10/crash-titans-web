"""Inspect literal template callbacks and bind their arguments to source debug names.

No source code or PS2 bytecode is executed. Unsupported instructions are retained
by LiteralReader; this extractor only accepts the straight-line setter call.
"""
from lua_bytecode import Reader
from convert_level_logic import LiteralReader

def template_data(archive):
    setters={};templates={};reader=LiteralReader()
    paths=['script\\SpawnableTemplateActor.blua']+[f'script\\NonSpawnableTemplateActor{i}.blua' for i in range(4)]
    for path in paths:
        root=Reader(archive.read(path)).function();registers={}
        for word in root['code']:
            op=word&63;a=word>>24;bx=(word>>6)&0x3ffff
            if op==35:registers[a]=root['children'][bx]
            elif op==7 and a in registers:
                name=root['constants'][bx]
                if name.startswith('SetBehaviourData'):setters[name]=registers[a]
        for event in reader.parse(root):
            assignment=event.get('assignment',{});value=assignment.get('value')
            if isinstance(value,dict) and 'closure' in value and isinstance(assignment.get('field'),str):
                templates[assignment['field']]=(path,root['children'][value['closure']])
    result={}
    for name,(path,function) in templates.items():
        for callback in function['children']:
            events=reader.parse(callback,[{'argument':'bc'}])
            for event in events:
                setter=event.get('function',{}).get('global','')
                if setter not in setters:continue
                args=event['arguments'];definition=setters[setter]
                assert len(args)==definition['params'],(name,setter,len(args),definition['params'])
                fields={local['name']:arg for local,arg in zip(definition['locals'][:definition['params']],args) if local['name'] not in ('bc','DO_NOT_USE')}
                result[name]=dict(source=path,line=callback['line'],setter=setter,fields=fields)
    return result
