/* =========================================================
   scenes/backdrop.js — cúpula de fondo con capas.
   Un único shader dibuja: degradado de cielo, halo de horizonte,
   nubes (web/estudio), sol y rayas arcade (juegos), colinas (estudio),
   lluvia de datos y circuitos (sistemas) y estrellas (noche).
   Los pesos y colores vienen de IV.PAL, que cambia de forma continua
   con el progreso: no hay cortes entre distritos.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  IV.build.push(['Fondo · cielo por capas', () => {
    const S = IV.S;
    const mat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new T.Color() }, uMid: { value: new T.Color() }, uBot: { value: new T.Color() }, uAcc: { value: new T.Color() },
        uSt: { value: new T.Vector4() }, uT: { value: 0 }, uNight: { value: 0 }, uShow: { value: 1 }
      },
      vertexShader: 'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vD;uniform vec3 uTop,uMid,uBot,uAcc;uniform vec4 uSt;uniform float uT,uNight,uShow;
        float h1(float n){return fract(sin(n*91.345)*43758.5453);}
        float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){return n2(p)*.5+n2(p*2.03)*.28+n2(p*4.1)*.14+n2(p*8.3)*.08;}
        void main(){
          vec3 d=normalize(vD);float y=d.y;
          /* degradado de cielo + halo de horizonte */
          vec3 col=y>0.?mix(uMid,uTop,pow(y,.55)):mix(uMid,uBot,pow(-y,.45));
          col+=uAcc*exp(-abs(y)*8.)*.32;
          float az=atan(d.x,-d.z);

          /* nubes suaves (web y estudio): se ven en el hemisferio de arriba */
          vec2 cp=d.xz/(abs(y)+.28)*.55+vec2(uT*.012,uT*.004);
          float cl=smoothstep(.46,.86,fbm(cp*1.6));
          col=mix(col,vec3(.95,1.,1.),cl*(uSt.x*.62+uSt.z*.42)*smoothstep(-.02,.35,y));

          /* juegos: sol arcade con rayas + rejilla en el horizonte */
          vec3 sd=normalize(vec3(.0,.16,-1.));float sr=length(d-sd);
          float sun=smoothstep(.30,.285,sr);
          float stripes=step(.5,fract((y-.02)*38.))*smoothstep(.16,.02,y)+smoothstep(.16,.17,y);
          vec3 sunc=mix(vec3(1.,.35,.45),vec3(1.,.85,.35),smoothstep(.0,.3,y));
          col=mix(col,sunc,sun*min(stripes,1.)*uSt.y);
          col+=vec3(1.,.4,.55)*exp(-sr*5.)*.25*uSt.y;

          /* estudio: colinas verdes en el horizonte */
          float hill=.035+.05*sin(az*2.3+1.)+.03*sin(az*5.1)+.015*sin(az*11.);
          float below=step(y,hill)*step(-.02,y);
          col=mix(col,uBot*1.6+vec3(.02,.12,.04),below*uSt.z*.9);
          col+=vec3(.35,1.,.5)*smoothstep(.03,.0,abs(y-hill))*.18*uSt.z;

          /* sistemas: lluvia de datos y líneas de circuito sobre la cúpula */
          vec2 g=vec2(az*34.,y*26.);
          float colId=floor(g.x),sp=.15+.5*h1(colId);
          float rain=pow(fract(h1(colId*1.7)*9.-uT*sp+g.y*.12),10.);
          float cell=step(.55,h2(floor(g)));
          col+=uAcc*rain*cell*uSt.w*.65*smoothstep(-.05,.3,y);
          float line=smoothstep(.04,.0,abs(fract(y*9.)-.5)-.46)*step(.6,h1(floor(y*9.)));
          col+=uAcc*line*uSt.w*.16;

          /* estrellas (noche) y destellos finos */
          vec3 p3=floor(d*170.);
          float st=step(.9972,h3(p3))*(.5+.5*sin(uT*2.+h3(p3)*40.));
          col+=vec3(.8,.95,1.)*st*uNight*smoothstep(.0,.25,y);
          gl_FragColor=vec4(col*uShow,1.);
        }`
    });
    const dome = new T.Mesh(new T.SphereGeometry(250, 32, 20), mat);
    dome.frustumCulled = false; dome.renderOrder = -10;
    IV.scene.add(dome);

    const P = IV.P;
    IV.scenes.backdrop = {
      group: dome, range: [0, 1],
      update() {
        const u = mat.uniforms, p = IV.PAL;
        dome.position.copy(IV.cam.position);
        u.uTop.value.copy(p.top); u.uMid.value.copy(p.mid); u.uBot.value.copy(p.bot); u.uAcc.value.copy(p.acc);
        u.uSt.value.copy(p.st); u.uNight.value = p.night; u.uT.value = S.t;
        u.uShow.value = 1 - IV.ss(P.d1 - .02, P.d1 + .02, S.ps) * 0;   // bajo tierra la cueva lo tapa; se mantiene por si hay huecos
      }
    };
    IV.sceneList.push(IV.scenes.backdrop);
  }]);
})();
