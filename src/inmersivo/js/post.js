/* =========================================================
   post.js — post-proceso de UNA pasada:
   lente/barril, píxel por velocidad, ondas del ratón,
   aberración cromática, bloom barato, scanlines, grano,
   transiciones (glitch por franjas) y mezcla CRT↔Aero.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  IV.initPost = function () {
    const R = IV.R;
    const rt = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    const mat = new T.ShaderMaterial({
      uniforms: {
        t: { value: rt.texture }, time: { value: 0 }, v: { value: 0 }, tr: { value: 0 }, aero: { value: .6 },
        m: { value: new T.Vector2(.5, .5) }, res: { value: new T.Vector2(2, 2) }
      },
      vertexShader: 'varying vec2 u;void main(){u=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        uniform sampler2D t;uniform float time,v,tr,aero;uniform vec2 m,res;varying vec2 u;
        float h1(float n){return fract(sin(n*91.345)*43758.5453);}
        float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          vec2 uv=u;
          /* lente: barril suave que crece con la velocidad (cámara "estirándose") */
          vec2 c=uv-.5;float r2=dot(c,c);
          float ed=smoothstep(.12,.72,length(c)*1.5);          /* 0 en el centro, 1 en los bordes: los efectos se quedan fuera del centro */
          uv=.5+c*(1.-.04+(.06+v*.05*ed)*r2*2.);
          /* transición: franjas horizontales desplazadas */
          float row=floor(uv.y*38.);
          float on=step(.6,h1(row*1.7+floor(time*9.)));
          uv.x+=(h1(row+floor(time*13.))-.5)*tr*.03*on*ed;
          /* píxel por velocidad + transición */
          float k=clamp((v*.45+tr*.25)*ed,0.,1.);k*=k;
          vec2 g=mix(res,res/3.5,k);uv=floor(uv*g)/g;
          /* ondas alrededor del ratón */
          vec2 d=uv-m;d.x*=res.x/res.y;float r=length(d);
          uv+=normalize(d+1e-4)*.005*smoothstep(.28,0.,r)*(.5+v*.4);
          /* aberración cromática */
          float a=.0006+(v*.004+tr*.005)*ed;
          vec3 col=vec3(texture2D(t,uv+vec2(a,0.)).r,texture2D(t,uv).g,texture2D(t,uv-vec2(a,0.)).b);
          /* bloom barato: 16 taps sobre el brillo */
          vec3 b=vec3(0.);
          for(int i=0;i<8;i++){
            float an=float(i)*.785398;vec2 o=vec2(cos(an),sin(an))*vec2(res.y/res.x,1.);
            b+=max(texture2D(t,uv+o*.007).rgb-.7,0.)+max(texture2D(t,uv+o*.019).rgb-.7,0.)*.8;
          }
          col+=b*(.05+aero*.07);
          /* Aero: negros azulados, brillo de cristal arriba, glow en transiciones */
          col=mix(col,col*vec3(.93,1.02,1.1)+vec3(0.,.010,.028),aero);
          col+=aero*.035*vec3(.55,.9,1.)*smoothstep(.45,1.,u.y);
          col+=vec3(.35,.9,1.)*tr*.05*(1.-abs(u.y-.5)*1.6);
          /* CRT: scanlines + grano + viñeta */
          col*=1.-(1.-aero*.7)*.07*(.5+.5*sin(u.y*res.y*1.15));
          col+=(h2(u*res+time)-.5)*.035;
          col*=1.-.5*dot(c,c)*1.6;
          gl_FragColor=vec4(col,1.);
        }`
    });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    const qs = new T.Scene(); qs.add(quad);
    const qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    IV.post = {
      rt, mat,
      resize(w, h) { rt.setSize(w, h); mat.uniforms.res.value.set(w, h); },
      render() {
        const S = IV.S, u = mat.uniforms;
        u.time.value = S.t; u.v.value = IV.RM ? 0 : S.v; u.tr.value = IV.RM ? 0 : S.tr;
        u.aero.value = S.aero; u.m.value.set(S.sx, S.sy);
        R.setRenderTarget(rt); R.render(IV.scene, IV.cam);
        R.setRenderTarget(null); R.render(qs, qc);
      }
    };
  };
})();
