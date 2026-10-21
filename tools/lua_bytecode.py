from pathlib import Path
import struct,json

class Reader:
    def __init__(self,b):self.b=b;self.p=14
    def read(self,n):
        d=self.b[self.p:self.p+n];self.p+=n
        if len(d)!=n:raise ValueError(f'EOF {self.p}')
        return d
    def u32(self):return struct.unpack('<I',self.read(4))[0]
    def byte(self):return self.read(1)[0]
    def string(self):
        n=self.u32()
        if n>1000000:raise ValueError(f'String length {n} at {self.p}')
        return self.read(n).rstrip(b'\0').decode('utf-8',errors='replace') if n else ''
    def function(self):
        start=self.p;name=self.string();line=self.u32();ups,params,vararg,stack=self.read(4)
        lines=self.u32();self.read(lines*2)
        locals=[]
        for i in range(self.u32()):locals.append(dict(name=self.string(),start=self.u32(),end=self.u32()))
        upnames=[self.string() for i in range(self.u32())]
        constants=[]
        for i in range(self.u32()):
            tag=self.byte()
            if tag==0:v=None
            elif tag==1:v=bool(self.byte())
            elif tag==3:v=struct.unpack('<f',self.read(4))[0]
            elif tag==4:v=self.string()
            else:raise ValueError(f'Constant tag {tag} at {self.p}')
            constants.append(v)
        children=[self.function() for i in range(self.u32())]
        n=self.u32();code=list(struct.unpack('<'+str(n)+'I',self.read(n*4)))
        return dict(source=name,line=line,start=start,params=params,stack=stack,locals=locals,upnames=upnames,constants=constants,children=children,code=code)

if __name__=='__main__':
    import sys
    name=sys.argv[1] if len(sys.argv)>1 else 'crash.blua'
    b=Path('work/crash-samples',name).read_bytes();r=Reader(b)
    try:
        f=r.function();print('Parsed',len(b),r.p);Path('work',name+'.json').write_text(json.dumps(f,indent=2))
        print('constants',f['constants']);print('children',len(f['children']),'ops',len(f['code']))
    except Exception as ex:print('ERROR',ex,'pos',r.p,'hex',b[r.p:r.p+32].hex())
