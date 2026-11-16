/* =========================================================
   scenes/backdrop.js — cúpula de cielo "Aero", por capas.
   Un único shader dibuja: degradado luminoso, halo de horizonte, nubes suaves,
   sol con rayos de luz, bokeh de colores (juegos), colinas con luz entre hojas
   (estudio), cáusticas de acuario y plancton luminoso (sistemas) y estrellas
   solo de noche. Los pesos y colores vienen de IV.PAL y cambian de forma
   continua con el progreso: no hay cortes entre islas.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  IV.build.push(['Fondo · cielo Aero por capas', () => {
    const S = IV.S;
    const mat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new T.Color() }, uMid: { value: new T.Color() }, uBot: { value: new T.Color() }, uAcc: { value: new T.Color() },
        uSt: { value: new T.Vector4() }, uT: { value: 0 }, uNight: { value: 0 }
      },
      vertexShader: 'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vD;uniform vec3 uTop,uMid,uBot,uAcc;uniform vec4 uSt;uniform float uT,uNight;
        float h1(float n){return fract(sin(n*91.345)*43758.5453);}
        float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){return n2(p)*.5+n2(p*2.03)*.28+n2(p*4.1)*.14+n2(p*8.3)*.08;}
        void main(){
          vec3 d=normalize(vD);float y=d.y,az=atan(d.x,-d.z);
          /* degradado de cielo + halo de horizonte (suave, luminoso) */
          vec3 col=y>0.?mix(uMid,uTop,pow(y,.5)):mix(uMid,uBot,pow(-y,.4));
          col+=uAcc*exp(-abs(y)*7.)*.30;

          /* sol con halo y rayos (web y estudio fuertes, juegos suave) */
          vec3 sd=normalize(vec3(.28,.30,-1.));float sr=length(d-sd);
          float sunW=uSt.x*1.+uSt.z*.8+uSt.y*.6;
          float ang=atan(d.x-sd.x,d.y-sd.y);
          float rays=pow(max(0.,sin(ang*9.+uT*.05)*.5+.5),6.)*exp(-sr*2.6);
          col+=vec3(1.,.95,.8)*(exp(-sr*7.)*.55+exp(-sr*2.2)*.18+rays*.18)*sunW;
          col+=vec3(1.)*smoothstep(.045,.03,sr)*sunW*.9;

          /* nubes suaves: se ven arriba y se tiñen según la isla */
          vec2 cp=d.xz/(abs(y)+.30)*.55+vec2(uT*.010,uT*.004);
          float cl=smoothstep(.44,.86,fbm(cp*1.5));
          vec3 ccol=mix(vec3(.92,.97,1.),mix(vec3(1.,.86,.88),vec3(.9,1.,.92),uSt.z),clamp(uSt.y+uSt.z,0.,1.));
          col=mix(col,ccol,cl*(uSt.x*.62+uSt.y*.5+uSt.z*.46)*smoothstep(-.02,.34,y));

          /* juegos: bokeh de colores pastel, como globos de luz flotando */
          vec2 bg=vec2(az*5.,y*7.);vec2 bi=floor(bg);vec2 bf=fract(bg)-.5;
          float bh=h2(bi);float br=.18+.16*h2(bi+3.1);
          vec2 bo=(vec2(h2(bi+1.7),h2(bi+9.2))-.5)*.5;
          float bk=smoothstep(br,br-.05,length(bf-bo))*step(.55,bh)*smoothstep(-.05,.3,y);
          vec3 bc=.5+.5*cos(6.2831*(h2(bi+5.)+vec3(0.,.33,.67)));
          col+=bc*bk*.22*uSt.y;

          /* estudio: colinas suaves con luz entre las hojas */
          float hill=.03+.05*sin(az*2.3+1.)+.028*sin(az*5.1)+.012*sin(az*11.);
          float below=smoothstep(hill+.004,hill-.004,y)*step(-.03,y);
          col=mix(col,uBot*1.5+vec3(.03,.14,.05),below*uSt.z*.85);
          float shaft=pow(max(0.,sin(az*7.+uT*.05)*sin(az*17.-uT*.04)),4.)*smoothstep(.0,.7,y);
          col+=vec3(1.,.96,.7)*shaft*.10*uSt.z;

          /* sistemas: acuario — haces de cáusticas desde arriba y plancton luminoso */
          float cs=pow(max(0.,sin(az*5.+uT*.12+sin(y*9.+uT*.2))*.5+.5),5.)*smoothstep(-.1,.8,y);
          col+=uAcc*cs*.22*uSt.w;
          vec3 pl=floor(d*85.);float pk=step(.992,h3(pl))*(.5+.5*sin(uT*1.4+h3(pl)*30.));
          col+=uAcc*pk*.8*uSt.w*smoothstep(-.2,.5,y);

          /* estrellas (solo de noche: portada y poco más) */
          vec3 p3=floor(d*170.);
          float st=step(.9972,h3(p3))*(.5+.5*sin(uT*2.+h3(p3)*40.));
          col+=vec3(.8,.95,1.)*st*uNight*smoothstep(.0,.25,y);
          gl_FragColor=vec4(col,1.);
        }`
    });
    const dome = new T.Mesh(new T.SphereGeometry(250, 32, 20), mat);
    dome.frustumCulled = false; dome.renderOrder = -10;
    IV.scene.add(dome);

    IV.scenes.backdrop = {
      group: dome, range: [0, 1],
      update() {
        const u = mat.uniforms, p = IV.PAL;
        dome.position.copy(IV.cam.position);
        u.uTop.value.copy(p.top); u.uMid.value.copy(p.mid); u.uBot.value.copy(p.bot); u.uAcc.value.copy(p.acc);
        u.uSt.value.copy(p.st); u.uNight.value = p.night; u.uT.value = S.t;
      }
    };
    IV.sceneList.push(IV.scenes.backdrop);
  }]);
})();
